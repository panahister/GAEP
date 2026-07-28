using System.Runtime.Serialization;
using Gaep.HostClient;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Shell;
using Microsoft.VisualStudio.Extensibility.UI;

namespace Gaep.VisualStudio;

[DataContract]
internal sealed class AgentSettingEditorData : NotifyPropertyChangedObject
{
    private string value = string.Empty;

    public AgentSettingEditorData(string key, string label, string description, string inputHint)
    {
        Key = key;
        Label = label;
        Description = description;
        InputHint = inputHint;
    }

    [DataMember]
    public string Key { get; }

    [DataMember]
    public string Label { get; }

    [DataMember]
    public string Description { get; }

    [DataMember]
    public string InputHint { get; }

    [DataMember]
    public string Value
    {
        get => value;
        set => SetProperty(ref this.value, value ?? string.Empty);
    }
}

[DataContract]
internal sealed class InitiativeClassificationEditorData
{
    [DataMember] public string PrimaryType { get; set; } = "feature";
    [DataMember] public string SecondaryTypes { get; set; } = string.Empty;
    [DataMember] public string SystemState { get; set; } = "unknown";
    [DataMember] public string ChangePosture { get; set; } = "existing";
    [DataMember] public string Motivations { get; set; } = "business-driven";
    [DataMember] public string UserInterface { get; set; } = "unknown";
    [DataMember] public string Data { get; set; } = "unknown";
    [DataMember] public string Integration { get; set; } = "unknown";
    [DataMember] public string InteractionModes { get; set; } = "interactive";
    [DataMember] public string Exposure { get; set; } = "unknown";
    [DataMember] public string Regulated { get; set; } = "false";
    [DataMember] public string PolicyDomains { get; set; } = string.Empty;
    [DataMember] public string Sensitivities { get; set; } = "unknown";
    [DataMember] public string ExpectedLifetime { get; set; } = "unknown";
    [DataMember] public string MaintenanceHorizon { get; set; } = string.Empty;
    [DataMember] public string BlastRadius { get; set; } = "unknown";
    [DataMember] public string Reversibility { get; set; } = "unknown";
    [DataMember] public string Urgency { get; set; } = "unknown";
    [DataMember] public string CostOfFailure { get; set; } = "unknown";
    [DataMember] public string Dependencies { get; set; } = string.Empty;
    [DataMember] public string AffectedAssets { get; set; } = string.Empty;
    [DataMember] public string Owner { get; set; } = string.Empty;
    [DataMember] public string AccountableAuthority { get; set; } = string.Empty;
    [DataMember] public string ConfidenceLevel { get; set; } = "medium";
    [DataMember] public string ConfidenceBasis { get; set; } = string.Empty;
    [DataMember] public string Evidence { get; set; } = string.Empty;
    [DataMember] public string UnresolvedQuestions { get; set; } = string.Empty;
    [DataMember] public string Rationale { get; set; } = string.Empty;
}

[DataContract]
internal sealed class InitiativeDecisionEditorData
{
    [DataMember] public string SubjectType { get; set; } = "activity";
    [DataMember] public string SubjectKey { get; set; } = string.Empty;
    [DataMember] public string SubjectLabel { get; set; } = string.Empty;
    [DataMember] public string Status { get; set; } = "required";
    [DataMember] public string Rationale { get; set; } = string.Empty;
    [DataMember] public string Sources { get; set; } = string.Empty;
    [DataMember] public string Owner { get; set; } = string.Empty;
    [DataMember] public string AccountableApprover { get; set; } = string.Empty;
    [DataMember] public string Dependencies { get; set; } = string.Empty;
    [DataMember] public string Conditions { get; set; } = string.Empty;
    [DataMember] public string ReviewTriggers { get; set; } = string.Empty;
    [DataMember] public string ApprovalState { get; set; } = "not-required";
    [DataMember] public string ApprovalConditions { get; set; } = string.Empty;
    [DataMember] public string RelatedRecords { get; set; } = string.Empty;
    [DataMember] public string RelatedImplementationUnits { get; set; } = string.Empty;
}

[DataContract]
internal sealed class InitiativeUnresolvedEditorData
{
    [DataMember] public string SubjectType { get; set; } = "activity";
    [DataMember] public string SubjectKey { get; set; } = string.Empty;
    [DataMember] public string SubjectLabel { get; set; } = string.Empty;
    [DataMember] public string Reason { get; set; } = string.Empty;
    [DataMember] public string Owner { get; set; } = string.Empty;
}

[DataContract]
internal sealed class GaepToolWindowData : NotifyPropertyChangedObject
{
    private readonly VisualStudioExtensibility extensibility;
    private readonly SemaphoreSlim requestGate = new(1, 1);
    private string workspacePath = Environment.GetEnvironmentVariable("GAEP_WORKSPACE_PATH") ?? string.Empty;
    private string bundlePath = string.Empty;
    private string bundleId = string.Empty;
    private string status = "GAEP engine has not been contacted";
    private string output = "Set one absolute local workspace folder, then refresh the Product.";
    private string initiativeId = string.Empty;
    private InitiativeEntryContext? initiativeEntryContext;
    private string? initiativeEntryWorkspace;
    private readonly List<InitiativeApplicabilityDecisionInput> initiativeDraftDecisions = [];
    private readonly List<InitiativeUnresolvedSubject> initiativeDraftUnresolved = [];
    private string initiativeDraftSummary = "No applicability decisions or unresolved subjects are staged.";
    private string[] availableChangeChoices = [];
    private string selectedChangeChoice = string.Empty;
    private ChangeImpactContext? changeImpactContext;
    private string? changeImpactWorkspace;
    private readonly string[] accessibleDashboardGroups =
    [
        "Phase dashboard tables",
        "Change and impact tables",
        "Agent and model tables",
    ];
    private string selectedAccessibleDashboardGroup = "Phase dashboard tables";
    private AccessibleMetadataTable[] accessibleTables = [];
    private string? accessibleTablesWorkspace;
    private string? loadedAccessibleDashboardGroup;
    private string[] availableAccessibleTables = [];
    private string selectedAccessibleTable = string.Empty;
    private string[] availableAccessibleSortColumns = [];
    private string selectedAccessibleSortColumn = string.Empty;
    private readonly string[] accessibleSortDirections = ["Ascending", "Descending"];
    private string selectedAccessibleSortDirection = "Ascending";
    private string accessibleFilter = string.Empty;
    private string accessibleCsv = string.Empty;
    private string[] availableAgentChoices = [];
    private string selectedAgentChoice = string.Empty;
    private string[] availableModelIds = [];
    private string selectedModelId = string.Empty;
    private AgentSettingEditorData[] agentSettingInputs = [];
    private AgentSelectionContext? agentSelectionContext;
    private string? agentSelectionWorkspace;
    private AgentHandoffContext? agentHandoffContext;
    private string? agentHandoffWorkspace;
    private string handoffReason = string.Empty;
    private string handoffCompletedWork = string.Empty;
    private string handoffUnresolvedMatters = string.Empty;
    private string handoffDecisions = string.Empty;
    private string handoffEvidence = string.Empty;
    private string managedCharterId = string.Empty;
    private string managedWorkflowPlanId = string.Empty;
    private ManagedReadOnlyPreview? managedReadOnlyPreview;
    private string? managedReadOnlyWorkspace;
    private string managedRunId = string.Empty;
    private readonly List<ManagedRunSummaryPage> managedEvidencePages = [];
    private string? managedEvidenceWorkspace;
    private string managedReviewRunId = string.Empty;
    private ManagedReviewPreview? managedReviewPreview;
    private string? managedReviewWorkspace;
    private bool busy;

    private readonly string[] initiativeTypes =
    [
        "product", "platform", "product-increment", "feature", "epic", "backlog-item", "service", "module",
        "client-application", "mobile-application", "api", "integration", "migration", "modernization",
        "refactoring", "technical-debt-remediation", "security-remediation", "infrastructure", "devops",
        "observability", "library", "sdk", "cli", "worker", "event-processor", "defect-fix", "experiment",
        "research", "data-capability", "ai-capability",
    ];
    private readonly string[] initiativeSystemStates = ["greenfield", "brownfield", "mixed", "unknown"];
    private readonly string[] initiativeChangePostures =
        ["new", "existing", "replacement", "modernization", "migration", "retirement", "mixed"];
    private readonly string[] initiativeUiStates = ["ui-bearing", "non-ui", "unknown"];
    private readonly string[] initiativeDataStates = ["data-bearing", "stateless", "unknown"];
    private readonly string[] initiativeIntegrationStates = ["integration-heavy", "isolated", "mixed", "unknown"];
    private readonly string[] initiativeExposures = ["internal", "partner", "public", "mixed", "unknown"];
    private readonly string[] initiativeBooleanChoices = ["false", "true"];
    private readonly string[] initiativeLifetimes = ["short-lived", "medium-term", "long-lived", "indefinite", "unknown"];
    private readonly string[] initiativeBlastRadii = ["localized", "multi-unit", "organization", "external", "unknown"];
    private readonly string[] initiativeReversibilities = ["reversible", "partially-reversible", "irreversible", "unknown"];
    private readonly string[] initiativeUrgencies = ["low", "normal", "high", "critical", "unknown"];
    private readonly string[] initiativeFailureCosts = ["low", "medium", "high", "critical", "unknown"];
    private readonly string[] initiativeConfidenceLevels = ["low", "medium", "high"];
    private readonly string[] initiativeSubjectTypes =
        ["phase", "activity", "artifact", "capability", "test-method", "test-level", "approval", "evidence-obligation"];
    private readonly string[] initiativeApplicabilityStatuses =
    [
        "required", "recommended", "optional", "not-applicable", "deferred", "conditionally-required",
        "already-satisfied", "reused", "blocked", "awaiting-human-decision",
    ];
    private readonly string[] initiativeApprovalStates = ["not-required", "pending", "approved", "rejected"];

    public GaepToolWindowData(VisualStudioExtensibility extensibility)
    {
        this.extensibility = extensibility ?? throw new ArgumentNullException(nameof(extensibility));
        RefreshProductCommand = new AsyncCommand(RefreshProductAsync);
        LoadInitiativeEntryCommand = new AsyncCommand(LoadInitiativeEntryAsync);
        LoadSourceGovernanceCommand = new AsyncCommand(LoadSourceGovernanceAsync);
        LoadBusinessUnderstandingCommand = new AsyncCommand(LoadBusinessUnderstandingAsync);
        LoadBusinessCapabilityMapCommand = new AsyncCommand(LoadBusinessCapabilityMapAsync);
        LoadValueStreamModelCommand = new AsyncCommand(LoadValueStreamModelAsync);
        LoadOperatingModelCommand = new AsyncCommand(LoadOperatingModelAsync);
        LoadBusinessRulesCommand = new AsyncCommand(LoadBusinessRulesAsync);
        LoadBusinessArchitectureBaselineCommand = new AsyncCommand(LoadBusinessArchitectureBaselineAsync);
        LoadSystemSolutionArchitectureCommand = new AsyncCommand(LoadSystemSolutionArchitectureAsync);
        LoadBoundedContextModelCommand = new AsyncCommand(LoadBoundedContextModelAsync);
        LoadSecurityPrivacyAssessmentCommand = new AsyncCommand(LoadSecurityPrivacyAssessmentAsync);
        LoadProcessModelCommand = new AsyncCommand(LoadProcessModelAsync);
        LoadDataModelCommand = new AsyncCommand(LoadDataModelAsync);
        LoadAuthorizationModelCommand = new AsyncCommand(LoadAuthorizationModelAsync);
        LoadEventIntegrationModelCommand = new AsyncCommand(LoadEventIntegrationModelAsync);
        LoadFailureRecoveryModelCommand = new AsyncCommand(LoadFailureRecoveryModelAsync);
        LoadArchitectureChallengeModelCommand = new AsyncCommand(LoadArchitectureChallengeModelAsync);
        LoadDecisionRegisterCommand = new AsyncCommand(LoadDecisionRegisterAsync);
        LoadRiskRegisterCommand = new AsyncCommand(LoadRiskRegisterAsync);
        LoadEvidenceRegistryCommand = new AsyncCommand(LoadEvidenceRegistryAsync);
        LoadEndToEndTraceabilityCommand = new AsyncCommand(LoadEndToEndTraceabilityAsync);
        LoadP0P4ReadinessGateCommand = new AsyncCommand(LoadP0P4ReadinessGateAsync);
        LoadP5HandoffPackageCommand = new AsyncCommand(LoadP5HandoffPackageAsync);
        LoadDesignApplicabilityCommand = new AsyncCommand(LoadDesignApplicabilityAsync);
        LoadDesignPersonaRoleCommand = new AsyncCommand(LoadDesignPersonaRoleAsync);
        LoadUserJourneyCommand = new AsyncCommand(LoadUserJourneyAsync);
        LoadInformationArchitectureCommand = new AsyncCommand(LoadInformationArchitectureAsync);
        LoadScreenStateInventoryCommand = new AsyncCommand(LoadScreenStateInventoryAsync);
        LoadDesignRequirementsCommand = new AsyncCommand(LoadDesignRequirementsAsync);
        ClassifyInitiativeCommand = new AsyncCommand(ClassifyInitiativeAsync);
        AddInitiativeDecisionCommand = new AsyncCommand(AddInitiativeDecisionAsync);
        AddInitiativeUnresolvedCommand = new AsyncCommand(AddInitiativeUnresolvedAsync);
        ClearInitiativeDraftCommand = new AsyncCommand(ClearInitiativeDraftAsync);
        ResolveInitiativeApplicabilityCommand = new AsyncCommand(ResolveInitiativeApplicabilityAsync);
        ShowPhaseDashboardCommand = new AsyncCommand(ShowPhaseDashboardAsync);
        ShowPhase1SummaryCommand = new AsyncCommand(ShowPhase1SummaryAsync);
        ShowPhase1ChangeImpactCommand = new AsyncCommand(ShowPhase1ChangeImpactAsync);
        LoadChangeImpactCommand = new AsyncCommand(LoadChangeImpactAsync);
        ShowChangeImpactCommand = new AsyncCommand(ShowChangeImpactAsync);
        ShowAgentModelCommand = new AsyncCommand(ShowAgentModelAsync);
        ShowPhase1AgentModelCommand = new AsyncCommand(ShowPhase1AgentModelAsync);
        LoadAccessibleTablesCommand = new AsyncCommand(LoadAccessibleTablesAsync);
        RenderAccessibleTableCommand = new AsyncCommand(RenderAccessibleTableAsync);
        RefreshAgentReadinessCommand = new AsyncCommand(RefreshAgentReadinessAsync);
        LoadAgentSelectionCommand = new AsyncCommand(LoadAgentSelectionAsync);
        SelectAgentCommand = new AsyncCommand(SelectAgentAsync);
        LoadAgentHandoffCommand = new AsyncCommand(LoadAgentHandoffAsync);
        CreateAgentHandoffCommand = new AsyncCommand(CreateAgentHandoffAsync);
        LoadManagedReadOnlyPreviewCommand = new AsyncCommand(LoadManagedReadOnlyPreviewAsync);
        ExecuteManagedReadOnlyCommand = new AsyncCommand(ExecuteManagedReadOnlyAsync);
        ListManagedEvidenceCommand = new AsyncCommand(ListManagedEvidenceAsync);
        PreviousManagedEvidencePageCommand = new AsyncCommand(PreviousManagedEvidencePageAsync);
        NextManagedEvidencePageCommand = new AsyncCommand(NextManagedEvidencePageAsync);
        ReadManagedEvidenceCommand = new AsyncCommand(ReadManagedEvidenceAsync);
        LoadManagedReviewCommand = new AsyncCommand(LoadManagedReviewAsync);
        ApplyManagedReviewCommand = new AsyncCommand(ApplyManagedReviewAsync);
        DiscardManagedReviewCommand = new AsyncCommand(DiscardManagedReviewAsync);
        ListDesignImportsCommand = new AsyncCommand(ListDesignImportsAsync);
        ReadDesignImportCommand = new AsyncCommand(ReadDesignImportAsync);
        ImportDesignBundleCommand = new AsyncCommand(ImportDesignBundleAsync);
    }

    [DataMember]
    public string Heading { get; } = "GAEP Product Studio";

    [DataMember]
    public string Summary { get; } =
        "The Visual Studio extension runs outside the IDE process and keeps Product authority in the shared local GAEP engine.";

    [DataMember]
    public string GovernanceBoundary { get; } =
        "Initiative entry reads and assessments are exact Product- and revision-bound projections. Classification and applicability require explicit human inputs plus cancel-default confirmation; absence never means not applicable, and no result grants approval, readiness, execution, implementation, or release authority. Source governance is an exact Initiative-bound, bounded metadata view of Sources, candidate Baselines, and Provenance; it exposes no Source bytes, locators, local paths, or credentials and cannot designate a Baseline, approve readiness, transfer authority, or authorize action. Business Understanding is an exact Initiative-bound privacy-safe view of governed record identities, revisions, digests, states, counts, and assessment status; it exposes no business narrative, personal assignments, Source content, locators, local paths, or credentials and cannot approve, appoint, decide, designate readiness, or authorize action. Architecture Challenge is an exact Initiative-bound privacy-safe candidate metadata view; it exposes no challenge content, assumptions, evidence, findings, responses, Source content, personal data, local paths, secrets, or credentials and cannot complete independent review, establish assurance, accept risk, approve architecture, establish readiness, promote a baseline, or authorize action. Decision Register is an exact Initiative-bound privacy-safe candidate metadata view; it exposes no decision questions, options, recommendations, outcomes, rationale, evidence, subject content, personal data, local paths, secrets, or credentials and cannot establish decision effectiveness, approval, risk acceptance, baseline promotion, readiness, or action authority. Phase dashboards are exact read-only governed-state projections; they cannot decide applicability, approve a phase, establish readiness, or grant implementation or release authority. Change/Impact selection and projection are exact audit-gated metadata views; they cannot approve a Change, accept a Risk, mutate records, or authorize effects. Agent/Model is an exact Product-, capability-, and selection-bound metadata projection; it cannot select, switch, hand off, launch, authorize effects, establish readiness, or invent usage/cost. Accessible dashboard tables sort and filter only already-verified metadata, expose exact visible/omitted/source totals, and prepare formula-neutralized CSV for native UI copy without file authority. Codex and Claude readiness is observation-only. Guarded selection and versioned handoff record portable configuration and history only; they cannot start or resume a provider, create a Run, approve tools or effects, or grant execution authority. Managed read-only execution is a separate exact-digest command: every Tool remains denied, only observation is allowed, and provider completion is reported separately from governed outcome. Managed Run evidence inventory/detail is audit-gated, bounded, private-safe observation only; it cannot start, resume, cancel, apply, discard, approve, or grant outcome authority. Exact staged review is a separate two-confirmation flow bound to one Run revision, preview digest, complete changed-file inventory, and host-owned write envelope; post-apply gates remain not assessed and persisted state does not prove cleanup. Portable-design imports remain pending human review. Upstream approval is not GAEP approval, a Design Baseline, implementation readiness, or release readiness. Only validated metadata and digests are displayed.";

    [DataMember]
    public IAsyncCommand RefreshProductCommand { get; }

    [DataMember]
    public IAsyncCommand LoadInitiativeEntryCommand { get; }

    [DataMember]
    public IAsyncCommand LoadSourceGovernanceCommand { get; }

    [DataMember]
    public IAsyncCommand LoadBusinessUnderstandingCommand { get; }

    [DataMember]
    public IAsyncCommand LoadBusinessCapabilityMapCommand { get; }

    [DataMember]
    public IAsyncCommand LoadValueStreamModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadOperatingModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadBusinessRulesCommand { get; }

    [DataMember]
    public IAsyncCommand LoadBusinessArchitectureBaselineCommand { get; }

    [DataMember]
    public IAsyncCommand LoadSystemSolutionArchitectureCommand { get; }

    [DataMember]
    public IAsyncCommand LoadBoundedContextModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadSecurityPrivacyAssessmentCommand { get; }

    [DataMember]
    public IAsyncCommand LoadProcessModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadDataModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadAuthorizationModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadEventIntegrationModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadFailureRecoveryModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadArchitectureChallengeModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadDecisionRegisterCommand { get; }

    [DataMember]
    public IAsyncCommand LoadRiskRegisterCommand { get; }

    [DataMember]
    public IAsyncCommand LoadEvidenceRegistryCommand { get; }

    [DataMember]
    public IAsyncCommand LoadEndToEndTraceabilityCommand { get; }

    [DataMember]
    public IAsyncCommand LoadP0P4ReadinessGateCommand { get; }

    [DataMember]
    public IAsyncCommand LoadP5HandoffPackageCommand { get; }

    [DataMember]
    public IAsyncCommand LoadDesignApplicabilityCommand { get; }

    [DataMember]
    public IAsyncCommand LoadDesignPersonaRoleCommand { get; }

    [DataMember]
    public IAsyncCommand LoadUserJourneyCommand { get; }

    [DataMember]
    public IAsyncCommand LoadInformationArchitectureCommand { get; }

    [DataMember]
    public IAsyncCommand LoadScreenStateInventoryCommand { get; }

    [DataMember]
    public IAsyncCommand LoadDesignRequirementsCommand { get; }

    [DataMember]
    public IAsyncCommand ClassifyInitiativeCommand { get; }

    [DataMember]
    public IAsyncCommand AddInitiativeDecisionCommand { get; }

    [DataMember]
    public IAsyncCommand AddInitiativeUnresolvedCommand { get; }

    [DataMember]
    public IAsyncCommand ClearInitiativeDraftCommand { get; }

    [DataMember]
    public IAsyncCommand ResolveInitiativeApplicabilityCommand { get; }

    [DataMember]
    public IAsyncCommand ShowPhaseDashboardCommand { get; }

    [DataMember]
    public IAsyncCommand ShowPhase1SummaryCommand { get; }

    [DataMember]
    public IAsyncCommand ShowPhase1ChangeImpactCommand { get; }

    [DataMember]
    public IAsyncCommand LoadChangeImpactCommand { get; }

    [DataMember]
    public IAsyncCommand ShowChangeImpactCommand { get; }

    [DataMember]
    public IAsyncCommand ShowAgentModelCommand { get; }

    [DataMember]
    public IAsyncCommand ShowPhase1AgentModelCommand { get; }

    [DataMember]
    public IAsyncCommand LoadAccessibleTablesCommand { get; }

    [DataMember]
    public IAsyncCommand RenderAccessibleTableCommand { get; }

    [DataMember]
    public IAsyncCommand RefreshAgentReadinessCommand { get; }

    [DataMember]
    public IAsyncCommand LoadAgentSelectionCommand { get; }

    [DataMember]
    public IAsyncCommand SelectAgentCommand { get; }

    [DataMember]
    public IAsyncCommand LoadAgentHandoffCommand { get; }

    [DataMember]
    public IAsyncCommand CreateAgentHandoffCommand { get; }

    [DataMember]
    public IAsyncCommand LoadManagedReadOnlyPreviewCommand { get; }

    [DataMember]
    public IAsyncCommand ExecuteManagedReadOnlyCommand { get; }

    [DataMember]
    public IAsyncCommand ListManagedEvidenceCommand { get; }

    [DataMember]
    public IAsyncCommand PreviousManagedEvidencePageCommand { get; }

    [DataMember]
    public IAsyncCommand NextManagedEvidencePageCommand { get; }

    [DataMember]
    public IAsyncCommand ReadManagedEvidenceCommand { get; }

    [DataMember]
    public IAsyncCommand LoadManagedReviewCommand { get; }

    [DataMember]
    public IAsyncCommand ApplyManagedReviewCommand { get; }

    [DataMember]
    public IAsyncCommand DiscardManagedReviewCommand { get; }

    [DataMember]
    public IAsyncCommand ListDesignImportsCommand { get; }

    [DataMember]
    public IAsyncCommand ReadDesignImportCommand { get; }

    [DataMember]
    public IAsyncCommand ImportDesignBundleCommand { get; }

    [DataMember]
    public string InitiativeId
    {
        get => initiativeId;
        set => SetProperty(ref initiativeId, value ?? string.Empty);
    }

    [DataMember] public InitiativeClassificationEditorData InitiativeClassification { get; } = new();
    [DataMember] public InitiativeDecisionEditorData InitiativeDecision { get; } = new();
    [DataMember] public InitiativeUnresolvedEditorData InitiativeUnresolved { get; } = new();
    [DataMember] public string[] InitiativeTypes => initiativeTypes;
    [DataMember] public string[] InitiativeSystemStates => initiativeSystemStates;
    [DataMember] public string[] InitiativeChangePostures => initiativeChangePostures;
    [DataMember] public string[] InitiativeUiStates => initiativeUiStates;
    [DataMember] public string[] InitiativeDataStates => initiativeDataStates;
    [DataMember] public string[] InitiativeIntegrationStates => initiativeIntegrationStates;
    [DataMember] public string[] InitiativeExposures => initiativeExposures;
    [DataMember] public string[] InitiativeBooleanChoices => initiativeBooleanChoices;
    [DataMember] public string[] InitiativeLifetimes => initiativeLifetimes;
    [DataMember] public string[] InitiativeBlastRadii => initiativeBlastRadii;
    [DataMember] public string[] InitiativeReversibilities => initiativeReversibilities;
    [DataMember] public string[] InitiativeUrgencies => initiativeUrgencies;
    [DataMember] public string[] InitiativeFailureCosts => initiativeFailureCosts;
    [DataMember] public string[] InitiativeConfidenceLevels => initiativeConfidenceLevels;
    [DataMember] public string[] InitiativeSubjectTypes => initiativeSubjectTypes;
    [DataMember] public string[] InitiativeApplicabilityStatuses => initiativeApplicabilityStatuses;
    [DataMember] public string[] InitiativeApprovalStates => initiativeApprovalStates;

    [DataMember]
    public string InitiativeDraftSummary
    {
        get => initiativeDraftSummary;
        private set => SetProperty(ref initiativeDraftSummary, value);
    }

    [DataMember]
    public string[] AvailableChangeChoices
    {
        get => availableChangeChoices;
        private set => SetProperty(ref availableChangeChoices, value);
    }

    [DataMember]
    public string SelectedChangeChoice
    {
        get => selectedChangeChoice;
        set => SetProperty(ref selectedChangeChoice, value ?? string.Empty);
    }

    [DataMember]
    public string[] AccessibleDashboardGroups => accessibleDashboardGroups;

    [DataMember]
    public string SelectedAccessibleDashboardGroup
    {
        get => selectedAccessibleDashboardGroup;
        set => SetProperty(ref selectedAccessibleDashboardGroup, value ?? string.Empty);
    }

    [DataMember]
    public string[] AvailableAccessibleTables
    {
        get => availableAccessibleTables;
        private set => SetProperty(ref availableAccessibleTables, value);
    }

    [DataMember]
    public string SelectedAccessibleTable
    {
        get => selectedAccessibleTable;
        set
        {
            if (SetProperty(ref selectedAccessibleTable, value ?? string.Empty)) RebuildAccessibleSortColumns();
        }
    }

    [DataMember]
    public string[] AvailableAccessibleSortColumns
    {
        get => availableAccessibleSortColumns;
        private set => SetProperty(ref availableAccessibleSortColumns, value);
    }

    [DataMember]
    public string SelectedAccessibleSortColumn
    {
        get => selectedAccessibleSortColumn;
        set => SetProperty(ref selectedAccessibleSortColumn, value ?? string.Empty);
    }

    [DataMember]
    public string[] AccessibleSortDirections => accessibleSortDirections;

    [DataMember]
    public string SelectedAccessibleSortDirection
    {
        get => selectedAccessibleSortDirection;
        set => SetProperty(ref selectedAccessibleSortDirection, value ?? string.Empty);
    }

    [DataMember]
    public string AccessibleFilter
    {
        get => accessibleFilter;
        set => SetProperty(ref accessibleFilter, value ?? string.Empty);
    }

    [DataMember]
    public string AccessibleCsv
    {
        get => accessibleCsv;
        private set => SetProperty(ref accessibleCsv, value);
    }

    [DataMember]
    public string WorkspacePath
    {
        get => workspacePath;
        set => SetProperty(ref workspacePath, value ?? string.Empty);
    }

    [DataMember]
    public string BundlePath
    {
        get => bundlePath;
        set => SetProperty(ref bundlePath, value ?? string.Empty);
    }

    [DataMember]
    public string BundleId
    {
        get => bundleId;
        set => SetProperty(ref bundleId, value ?? string.Empty);
    }

    [DataMember]
    public string[] AvailableAgentChoices
    {
        get => availableAgentChoices;
        private set => SetProperty(ref availableAgentChoices, value);
    }

    [DataMember]
    public string SelectedAgentChoice
    {
        get => selectedAgentChoice;
        set
        {
            if (SetProperty(ref selectedAgentChoice, value ?? string.Empty)) RebuildAgentSelectionEditors();
        }
    }

    [DataMember]
    public string[] AvailableModelIds
    {
        get => availableModelIds;
        private set => SetProperty(ref availableModelIds, value);
    }

    [DataMember]
    public string SelectedModelId
    {
        get => selectedModelId;
        set => SetProperty(ref selectedModelId, value ?? string.Empty);
    }

    [DataMember]
    public AgentSettingEditorData[] AgentSettingInputs
    {
        get => agentSettingInputs;
        private set => SetProperty(ref agentSettingInputs, value);
    }

    [DataMember]
    public string HandoffReason
    {
        get => handoffReason;
        set => SetProperty(ref handoffReason, value ?? string.Empty);
    }

    [DataMember]
    public string HandoffCompletedWork
    {
        get => handoffCompletedWork;
        set => SetProperty(ref handoffCompletedWork, value ?? string.Empty);
    }

    [DataMember]
    public string HandoffUnresolvedMatters
    {
        get => handoffUnresolvedMatters;
        set => SetProperty(ref handoffUnresolvedMatters, value ?? string.Empty);
    }

    [DataMember]
    public string HandoffDecisions
    {
        get => handoffDecisions;
        set => SetProperty(ref handoffDecisions, value ?? string.Empty);
    }

    [DataMember]
    public string HandoffEvidence
    {
        get => handoffEvidence;
        set => SetProperty(ref handoffEvidence, value ?? string.Empty);
    }

    [DataMember]
    public string ManagedCharterId
    {
        get => managedCharterId;
        set => SetProperty(ref managedCharterId, value ?? string.Empty);
    }

    [DataMember]
    public string ManagedWorkflowPlanId
    {
        get => managedWorkflowPlanId;
        set => SetProperty(ref managedWorkflowPlanId, value ?? string.Empty);
    }

    [DataMember]
    public string ManagedRunId
    {
        get => managedRunId;
        set => SetProperty(ref managedRunId, value ?? string.Empty);
    }

    [DataMember]
    public string ManagedReviewRunId
    {
        get => managedReviewRunId;
        set => SetProperty(ref managedReviewRunId, value ?? string.Empty);
    }

    [DataMember]
    public string Status
    {
        get => status;
        private set => SetProperty(ref status, value);
    }

    [DataMember]
    public string Output
    {
        get => output;
        private set => SetProperty(ref output, value);
    }

    [DataMember]
    public bool Busy
    {
        get => busy;
        private set => SetProperty(ref busy, value);
    }

    private Task RefreshProductAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Refreshing Product",
            (controller, _, token) => controller.ReadProductAsync(token),
            cancellationToken);

    private Task LoadInitiativeEntryAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact Initiative entry",
            async (controller, workspace, token) =>
            {
                var id = ParseInitiativeId(InitiativeId);
                var context = await controller.ReadInitiativeEntryContextAsync(id, token);
                initiativeEntryContext = context;
                initiativeEntryWorkspace = workspace;
                initiativeDraftDecisions.Clear();
                initiativeDraftUnresolved.Clear();
                RefreshInitiativeDraftSummary();
                return ProductWorkflowController.RenderInitiativeEntry(context);
            },
            cancellationToken);

    private Task LoadSourceGovernanceAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact Source governance",
            (controller, _, token) => controller.ReadSourceGovernanceAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadBusinessUnderstandingAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Business Understanding",
            (controller, _, token) => controller.ReadBusinessUnderstandingAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadBusinessCapabilityMapAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Business Capability Map",
            (controller, _, token) => controller.ReadBusinessCapabilityMapAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadValueStreamModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Value Stream Model",
            (controller, _, token) => controller.ReadValueStreamModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadOperatingModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Operating Model",
            (controller, _, token) => controller.ReadOperatingModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadBusinessRulesAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Business Rule Catalog",
            (controller, _, token) => controller.ReadBusinessRuleCatalogAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadBusinessArchitectureBaselineAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Business Architecture Baseline candidate",
            (controller, _, token) => controller.ReadBusinessArchitectureBaselineAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadSystemSolutionArchitectureAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed System/Solution Architecture candidate",
            (controller, _, token) => controller.ReadSystemSolutionArchitectureAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadBoundedContextModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Bounded Context and Ownership candidate",
            (controller, _, token) => controller.ReadBoundedContextModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadSecurityPrivacyAssessmentAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Security, Privacy, and Threat Assessment candidate",
            (controller, _, token) => controller.ReadSecurityPrivacyAssessmentAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadProcessModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Process Model candidate",
            (controller, _, token) => controller.ReadProcessModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadDataModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Data Model candidate",
            (controller, _, token) => controller.ReadDataModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadAuthorizationModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Authorization Model candidate",
            (controller, _, token) => controller.ReadAuthorizationModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadEventIntegrationModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Event and Integration Model candidate",
            (controller, _, token) => controller.ReadEventIntegrationModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadFailureRecoveryModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Failure and Recovery Model candidate",
            (controller, _, token) => controller.ReadFailureRecoveryModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadArchitectureChallengeModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Architecture Challenge candidate",
            (controller, _, token) => controller.ReadArchitectureChallengeModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadDecisionRegisterAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Decision Register candidate",
            (controller, _, token) => controller.ReadDecisionRegisterAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadRiskRegisterAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Risk Register candidate",
            (controller, _, token) => controller.ReadRiskRegisterAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadEvidenceRegistryAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Evidence Registry candidate",
            (controller, _, token) => controller.ReadEvidenceRegistryAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadEndToEndTraceabilityAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed End-to-End Traceability candidate",
            (controller, _, token) => controller.ReadEndToEndTraceabilityAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadP0P4ReadinessGateAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed P0-P4 Readiness Gate candidate",
            (controller, _, token) => controller.ReadP0P4ReadinessGateAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadP5HandoffPackageAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed P5 Handoff Package candidate",
            (controller, _, token) => controller.ReadP5HandoffPackageAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadDesignApplicabilityAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Design Applicability candidate",
            (controller, _, token) => controller.ReadDesignApplicabilityAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadDesignPersonaRoleAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Design Personas and Roles candidate",
            (controller, _, token) => controller.ReadDesignPersonaRoleModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadUserJourneyAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed User Journeys candidate",
            (controller, _, token) => controller.ReadUserJourneyModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadInformationArchitectureAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Information Architecture candidate",
            (controller, _, token) => controller.ReadInformationArchitectureModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadScreenStateInventoryAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Screen and State Inventory candidate",
            (controller, _, token) => controller.ReadScreenStateInventoryAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadDesignRequirementsAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact governed Design Requirements candidate",
            (controller, _, token) => controller.ReadDesignRequirementsAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task ClassifyInitiativeAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        var context = initiativeEntryContext;
        if (context is null)
        {
            Status = "Initiative entry is not loaded";
            Output = "Load and review one exact Initiative entry before classifying it.";
            return Task.CompletedTask;
        }
        InitiativeClassificationInput input;
        try
        {
            input = ProductWorkflowController.ValidateInitiativeClassificationInput(BuildInitiativeClassificationInput());
        }
        catch (Exception error)
        {
            Status = "Initiative classification input is invalid";
            Output = ProductWorkflowController.SafeError(error);
            return Task.CompletedTask;
        }
        return RunRequestAsync(
            "Recording exact Initiative classification",
            async (controller, workspace, token) =>
            {
                EnsureInitiativeWorkspace(workspace, context);
                var actorId = CurrentActorId();
                var rendered = await controller.ClassifyInitiativeAsync(context, input, actorId, token);
                initiativeEntryContext = await controller.ReadInitiativeEntryContextAsync(context.Initiative.Id, token);
                return rendered;
            },
            cancellationToken,
            confirmationMessage:
                $"Record this exact human-authored Initiative classification against revision {context.Initiative.Revision}? " +
                "The engine will re-read Product and Initiative state, reject stale or substituted content, and invalidate " +
                "older applicability when required. Classification guides profile selection only; it grants no approval, " +
                "readiness, implementation, execution, or release authority.");
    }

    private Task AddInitiativeDecisionAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var candidate = BuildInitiativeDecisionInput();
            var subjectCatalog = LoadedInitiativeSubjectCatalog();
            var matrix = new InitiativeApplicabilityMatrixInput(
                [.. initiativeDraftDecisions, candidate],
                initiativeDraftUnresolved.ToArray(),
                subjectCatalog);
            ProductWorkflowController.ValidateInitiativeApplicabilityInput(matrix);
            initiativeDraftDecisions.Add(candidate);
            RefreshInitiativeDraftSummary();
            Status = "Applicability decision added to the local draft; no governed state changed";
            Output = InitiativeDraftSummary;
        }
        catch (Exception error)
        {
            Status = "Applicability decision input is invalid";
            Output = ProductWorkflowController.SafeError(error);
        }
        return Task.CompletedTask;
    }

    private Task AddInitiativeUnresolvedAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            if (initiativeDraftDecisions.Count == 0)
            {
                throw new ArgumentException("Add at least one explicit applicability decision before staging unresolved subjects.");
            }
            var candidate = BuildInitiativeUnresolvedSubject();
            var subjectCatalog = LoadedInitiativeSubjectCatalog();
            var matrix = new InitiativeApplicabilityMatrixInput(
                initiativeDraftDecisions.ToArray(),
                [.. initiativeDraftUnresolved, candidate],
                subjectCatalog);
            ProductWorkflowController.ValidateInitiativeApplicabilityInput(matrix);
            initiativeDraftUnresolved.Add(candidate);
            RefreshInitiativeDraftSummary();
            Status = "Unresolved applicability subject added to the local draft; no governed state changed";
            Output = InitiativeDraftSummary;
        }
        catch (Exception error)
        {
            Status = "Unresolved applicability input is invalid";
            Output = ProductWorkflowController.SafeError(error);
        }
        return Task.CompletedTask;
    }

    private Task ClearInitiativeDraftAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        initiativeDraftDecisions.Clear();
        initiativeDraftUnresolved.Clear();
        RefreshInitiativeDraftSummary();
        Status = "Local applicability draft cleared; no governed state changed";
        Output = InitiativeDraftSummary;
        return Task.CompletedTask;
    }

    private Task ResolveInitiativeApplicabilityAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        var context = initiativeEntryContext;
        if (context is null)
        {
            Status = "Initiative entry is not loaded";
            Output = "Load and review one exact Initiative entry before resolving applicability.";
            return Task.CompletedTask;
        }
        InitiativeApplicabilityMatrixInput matrix;
        try
        {
            var subjectCatalog = LoadedInitiativeSubjectCatalog();
            matrix = ProductWorkflowController.CompleteInitiativeApplicabilityInput(
                new InitiativeApplicabilityMatrixInput(
                    initiativeDraftDecisions.ToArray(),
                    initiativeDraftUnresolved.ToArray(),
                    subjectCatalog),
                CurrentActorId());
        }
        catch (Exception error)
        {
            Status = "Initiative applicability draft is invalid";
            Output = ProductWorkflowController.SafeError(error);
            return Task.CompletedTask;
        }
        return RunRequestAsync(
            "Recording exact Initiative applicability",
            async (controller, workspace, token) =>
            {
                EnsureInitiativeWorkspace(workspace, context);
                var rendered = await controller.ResolveInitiativeApplicabilityAsync(
                    context,
                    matrix,
                    CurrentActorId(),
                    token);
                initiativeEntryContext = await controller.ReadInitiativeEntryContextAsync(context.Initiative.Id, token);
                initiativeDraftDecisions.Clear();
                initiativeDraftUnresolved.Clear();
                RefreshInitiativeDraftSummary();
                return rendered;
            },
            cancellationToken,
            confirmationMessage:
                $"Record the exact staged applicability matrix against Initiative revision {context.Initiative.Revision}? " +
                $"It contains {matrix.Decisions.Count} explicit decision(s) and {matrix.UnresolvedSubjects.Count} explicit " +
                $"unresolved subject(s), bound to catalog {matrix.SubjectCatalog!.CatalogVersion} with " +
                $"{matrix.SubjectCatalog.SubjectCount} canonical subjects. Absence never means not applicable. " +
                "The engine will re-read the exact current " +
                "Product, Initiative, classification, actors, and input content. This grants no approval, readiness, " +
                "implementation, execution, or release authority.");
    }

    private Task ShowPhaseDashboardAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading Phase 0/1A dashboards",
            (controller, _, token) => controller.ReadPhaseDashboardAsync(token),
            cancellationToken);

    private Task ShowPhase1SummaryAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact Phase 1 summary",
            (controller, _, token) => controller.ReadPhase1SummaryAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task ShowPhase1ChangeImpactAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact Phase 1 Change/Impact projection",
            (controller, workspace, token) =>
            {
                var context = changeImpactContext
                    ?? throw new ArgumentException("Load the exact current Change catalog before opening a Phase 1 projection.");
                if (!StringComparer.Ordinal.Equals(changeImpactWorkspace, workspace))
                {
                    throw new ArgumentException("The workspace changed after the Change catalog was loaded. Load it again.");
                }
                var change = context.Catalog.Items.SingleOrDefault(item => ChangeChoice(item) == SelectedChangeChoice)
                    ?? throw new ArgumentException("Select one exact Change from the verified current catalog.");
                return controller.ReadPhase1ChangeImpactAsync(ParseInitiativeId(InitiativeId), context, change, token);
            },
            cancellationToken);

    private Task LoadChangeImpactAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact current Change catalog",
            async (controller, workspace, token) =>
            {
                var context = await controller.ReadChangeImpactContextAsync(token);
                if (context.Catalog.Items.Count == 0)
                {
                    throw new ArgumentException(
                        "No current Change metadata is available for the exact Change/Impact dashboard.");
                }
                changeImpactContext = context;
                changeImpactWorkspace = workspace;
                AvailableChangeChoices = context.Catalog.Items.Select(ChangeChoice).ToArray();
                SelectedChangeChoice = AvailableChangeChoices[0];
                return $"Verified {context.Catalog.Items.Count} of {context.Catalog.Total} exact current Change references; " +
                    $"{context.Catalog.Omitted} omitted. Select one below, then open its read-only projection. " +
                    "No Change approval, Risk acceptance, mutation, Run, Tool, write, or effect authority was granted.";
            },
            cancellationToken);

    private Task ShowChangeImpactAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact Change/Impact projection",
            (controller, workspace, token) =>
            {
                var context = changeImpactContext
                    ?? throw new ArgumentException("Load the exact current Change catalog before opening a projection.");
                if (!StringComparer.Ordinal.Equals(changeImpactWorkspace, workspace))
                {
                    throw new ArgumentException("The workspace changed after the Change catalog was loaded. Load it again.");
                }
                var change = context.Catalog.Items.SingleOrDefault(item => ChangeChoice(item) == SelectedChangeChoice)
                    ?? throw new ArgumentException("Select one exact Change from the verified current catalog.");
                return controller.ReadChangeImpactAsync(context, change, token);
            },
            cancellationToken);

    private Task ShowAgentModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact Agent and Model projection",
            (controller, _, token) => controller.ReadAgentModelAsync(token),
            cancellationToken);

    private Task ShowPhase1AgentModelAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact Phase 1 Agent and Model execution truth",
            (controller, _, token) => controller.ReadPhase1AgentModelAsync(ParseInitiativeId(InitiativeId), token),
            cancellationToken);

    private Task LoadAccessibleTablesAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact accessible dashboard tables",
            async (controller, workspace, token) =>
            {
                IReadOnlyList<AccessibleMetadataTable> tables = SelectedAccessibleDashboardGroup switch
                {
                    "Phase dashboard tables" => await controller.ReadPhaseDashboardTablesAsync(token),
                    "Change and impact tables" => await ReadAccessibleChangeImpactTablesAsync(
                        controller,
                        workspace,
                        token),
                    "Agent and model tables" => await controller.ReadAgentModelTablesAsync(token),
                    _ => throw new ArgumentException("Select one accessible dashboard table group."),
                };
                if (tables.Count == 0)
                {
                    throw new ArgumentException("No verified accessible dashboard table was returned.");
                }
                accessibleTables = tables.ToArray();
                accessibleTablesWorkspace = workspace;
                loadedAccessibleDashboardGroup = SelectedAccessibleDashboardGroup;
                AvailableAccessibleTables = accessibleTables.Select(AccessibleTableChoice).ToArray();
                SelectedAccessibleTable = AvailableAccessibleTables[0];
                AccessibleFilter = string.Empty;
                AccessibleCsv = string.Empty;
                return $"Verified {accessibleTables.Length} accessible {SelectedAccessibleDashboardGroup.ToLowerInvariant()} " +
                    "from strict metadata. Select one table, source order or a visible sort column, direction, and an optional " +
                    "256-character visible-metadata filter. Rendering and CSV preparation grant no state, approval, Run, Tool, " +
                    "write, effect, readiness, release, or acceptance authority.";
            },
            cancellationToken);

    private async Task<IReadOnlyList<AccessibleMetadataTable>> ReadAccessibleChangeImpactTablesAsync(
        ProductWorkflowController controller,
        string workspace,
        CancellationToken cancellationToken)
    {
        var context = changeImpactContext
            ?? throw new ArgumentException(
                "Load the exact current Change catalog and select one Change before loading accessible Change/Impact tables.");
        if (!StringComparer.Ordinal.Equals(changeImpactWorkspace, workspace))
        {
            throw new ArgumentException("The workspace changed after the Change catalog was loaded. Load it again.");
        }
        var change = context.Catalog.Items.SingleOrDefault(item => ChangeChoice(item) == SelectedChangeChoice)
            ?? throw new ArgumentException("Select one exact Change from the verified current catalog.");
        return await controller.ReadChangeImpactTablesAsync(context, change, cancellationToken);
    }

    private Task RenderAccessibleTableAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var workspace = ProductWorkflowController.NormalizeWorkspacePath(WorkspacePath);
            if (!StringComparer.Ordinal.Equals(accessibleTablesWorkspace, workspace) ||
                !StringComparer.Ordinal.Equals(loadedAccessibleDashboardGroup, SelectedAccessibleDashboardGroup))
            {
                throw new ArgumentException(
                    "The workspace or table group changed after accessible metadata was loaded. Load the exact tables again.");
            }
            var table = accessibleTables.SingleOrDefault(item => AccessibleTableChoice(item) == SelectedAccessibleTable)
                ?? throw new ArgumentException("Select one verified accessible metadata table.");
            var sourceOrder = "Keep verified source order";
            var sortColumn = table.Columns.SingleOrDefault(column => AccessibleSortChoice(column) == SelectedAccessibleSortColumn);
            string? sortKey = SelectedAccessibleSortColumn == sourceOrder
                ? null
                : sortColumn?.Key ?? throw new ArgumentException("Select source order or one visible table column.");
            AccessibleTableSortDirection? direction = sortKey is null
                ? null
                : SelectedAccessibleSortDirection switch
                {
                    "Ascending" => AccessibleTableSortDirection.Ascending,
                    "Descending" => AccessibleTableSortDirection.Descending,
                    _ => throw new ArgumentException("Select ascending or descending sort direction."),
                };
            var view = AccessibleDashboardTables.View(table, AccessibleFilter, sortKey, direction);
            Output = AccessibleDashboardTables.Render(view);
            AccessibleCsv = view.Rows.Count == 0 ? string.Empty : AccessibleDashboardTables.Csv(view);
            Status = $"{table.Title}: showing {view.Rows.Count} of {table.Rows.Count} verified rows; " +
                (view.Rows.Count == 0
                    ? "no CSV was prepared"
                    : "visible-row CSV is ready for native Select All and Copy");
        }
        catch (Exception error)
        {
            Status = error is OperationCanceledException ? "GAEP accessible table cancelled" : "GAEP accessible table stopped";
            Output = ProductWorkflowController.SafeError(error);
            AccessibleCsv = string.Empty;
        }
        return Task.CompletedTask;
    }

    private Task RefreshAgentReadinessAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Refreshing agent readiness",
            (controller, _, token) => controller.ReadAgentReadinessAsync(token),
            cancellationToken);

    private Task LoadAgentSelectionAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading guarded Agent Selection",
            async (controller, workspace, token) =>
            {
                var context = await controller.ReadAgentSelectionContextAsync(token);
                agentSelectionContext = context;
                agentSelectionWorkspace = workspace;
                agentHandoffContext = null;
                agentHandoffWorkspace = null;
                ConfigureAgentSelection(context);
                return "Verified local adapter, model, and non-sensitive portable-setting choices are ready. Review them below, then use Confirm guarded selection. No provider has been started and no state has changed.";
            },
            cancellationToken);

    private Task SelectAgentAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Recording guarded Agent Selection",
            (controller, workspace, token) =>
            {
                var context = agentSelectionContext
                    ?? throw new ArgumentException("Load the current guarded Agent Selection options before confirming.");
                if (!StringComparer.Ordinal.Equals(agentSelectionWorkspace, workspace))
                {
                    throw new ArgumentException("The workspace changed after Agent Selection options were loaded. Load them again.");
                }
                var snapshot = ResolveSelectedAgent(context);
                var inputs = AgentSettingInputs.ToDictionary(input => input.Key, input => input.Value, StringComparer.Ordinal);
                var settings = ProductWorkflowController.BuildAgentSelectionSettings(snapshot, inputs);
                var actorId = Environment.GetEnvironmentVariable("GAEP_ACTOR_ID") ?? "gaep.visual-studio-local-human";
                return controller.SelectAgentAsync(snapshot.AdapterId, SelectedModelId, settings, actorId, token);
            },
            cancellationToken,
            confirmationMessage:
                "Record the selected verified adapter, model, and explicit non-sensitive portable settings? This does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority. The engine will reject active-Run, capability-drift, legacy, invalid, and post-Run changes that require a handoff.");

    private Task LoadAgentHandoffAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading versioned Agent Handoff",
            async (controller, workspace, token) =>
            {
                var context = await controller.ReadAgentHandoffContextAsync(token);
                agentHandoffContext = context;
                agentHandoffWorkspace = workspace;
                var selectionContext = new AgentSelectionContext(
                    new AgentSelectionState(AgentSelectionStatus.Selected, context.Current, null),
                    context.Available);
                agentSelectionContext = selectionContext;
                agentSelectionWorkspace = workspace;
                ConfigureAgentSelection(selectionContext);
                HandoffReason = string.Empty;
                HandoffCompletedWork = string.Empty;
                HandoffUnresolvedMatters = string.Empty;
                HandoffDecisions = string.Empty;
                HandoffEvidence = string.Empty;
                return $"Versioned handoff context is bound to terminal Run {context.SourceRun.Id:D} and the exact current Agent Selection. Choose a changed target, enter portable history below, then confirm. No provider has been started and no state has changed.";
            },
            cancellationToken);

    private Task CreateAgentHandoffAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        var sourceRun = agentHandoffContext?.SourceRun.Id.ToString("D") ?? "not loaded";
        return RunRequestAsync(
            "Recording versioned Agent Handoff",
            (controller, workspace, token) =>
            {
                var context = agentHandoffContext
                    ?? throw new ArgumentException("Load the current versioned Agent Handoff context before confirming.");
                if (!StringComparer.Ordinal.Equals(agentHandoffWorkspace, workspace))
                {
                    throw new ArgumentException("The workspace changed after Agent Handoff context was loaded. Load it again.");
                }
                var selectionContext = agentSelectionContext
                    ?? throw new ArgumentException("Load the current versioned Agent Handoff context before confirming.");
                var snapshot = ResolveSelectedAgent(selectionContext);
                var inputs = AgentSettingInputs.ToDictionary(input => input.Key, input => input.Value, StringComparer.Ordinal);
                var settings = ProductWorkflowController.BuildAgentSelectionSettings(snapshot, inputs);
                var reason = ProductWorkflowController.NormalizeHandoffReason(HandoffReason);
                var completedWork = ProductWorkflowController.BuildHandoffTextList(HandoffCompletedWork, "Completed work");
                var unresolvedMatters = ProductWorkflowController.BuildHandoffTextList(HandoffUnresolvedMatters, "Unresolved matters");
                var decisions = ProductWorkflowController.BuildHandoffTextList(HandoffDecisions, "Decisions");
                var evidence = ProductWorkflowController.BuildHandoffTextList(HandoffEvidence, "Evidence");
                var actorId = Environment.GetEnvironmentVariable("GAEP_ACTOR_ID") ?? "gaep.visual-studio-local-human";
                return controller.CreateAgentHandoffAsync(
                    context,
                    snapshot.AdapterId,
                    SelectedModelId,
                    settings,
                    reason,
                    completedWork,
                    unresolvedMatters,
                    decisions,
                    evidence,
                    actorId,
                    token);
            },
            cancellationToken,
            confirmationMessage:
                $"Create a versioned handoff from terminal Run {sourceRun} to the selected changed adapter, model, and portable settings? The exact current selection, Run history, target identity/settings, and portable handoff details will be revalidated. This does not start or resume a provider, create a Run, approve tools or effects, or grant execution authority.");
    }

    private Task LoadManagedReadOnlyPreviewAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact managed read-only preview",
            async (controller, workspace, token) =>
            {
                var preview = await controller.PreviewManagedReadOnlyAsync(
                    ManagedCharterId,
                    ManagedWorkflowPlanId,
                    token);
                managedReadOnlyPreview = preview;
                managedReadOnlyWorkspace = workspace;
                return ProductWorkflowController.RenderManagedReadOnlyPreview(preview);
            },
            cancellationToken);

    private Task ExecuteManagedReadOnlyAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        var preview = managedReadOnlyPreview;
        if (preview is null)
        {
            Status = "Managed read-only preview is not loaded";
            Output = "Load and review the exact managed read-only preview before attesting execution.";
            return Task.CompletedTask;
        }
        return RunRequestAsync(
            "Executing attested managed read-only work",
            (controller, workspace, token) =>
            {
                if (!StringComparer.Ordinal.Equals(managedReadOnlyWorkspace, workspace))
                {
                    throw new ArgumentException(
                        "The workspace changed after the managed read-only preview was loaded. Load and review it again.");
                }
                if (!ReferenceEquals(preview, managedReadOnlyPreview))
                {
                    throw new ArgumentException(
                        "The managed read-only preview changed before execution. Load and review it again.");
                }
                var actorId = Environment.GetEnvironmentVariable("GAEP_ACTOR_ID") ?? "gaep.visual-studio-local-human";
                return controller.ExecuteManagedReadOnlyAsync(
                    preview,
                    actorId,
                    timeoutMs: 120_000,
                    cancellationToken: token);
            },
            cancellationToken,
            confirmationMessage:
                $"Attest this exact managed read-only preview?\n\n" +
                $"Preview digest: {preview.PreviewDigest}\n" +
                $"Provider: {preview.AgentId} / {preview.ModelId} ({preview.AdapterId})\n" +
                $"Strategy: {preview.Strategy}; steps: {preview.StepIds.Count}; gates: {preview.Gates.Count}\n" +
                $"Declared reads: {preview.ReadScopeCount}; context packs: {preview.ContextPackCount}\n\n" +
                "Every Tool permission is denied. No write scope or non-observation effect is granted. " +
                "The timeout is fixed at 120 seconds. The local protocol does not provide interactive provider cancel or resume. " +
                "Any Codex stage with changes, conflict, or pending review is discarded or rejected; only a proven zero-change stage may close automatically. " +
                "Provider completion and governed outcome remain separate claims.");
    }

    private Task ListManagedEvidenceAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading first verified Managed Run evidence page",
            async (controller, workspace, token) =>
            {
                var page = await controller.ListManagedEvidencePageAsync(cancellationToken: token);
                managedEvidencePages.Clear();
                managedEvidencePages.Add(page);
                managedEvidenceWorkspace = workspace;
                return ProductWorkflowController.RenderManagedEvidencePage(page);
            },
            cancellationToken);

    private Task PreviousManagedEvidencePageAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        if (managedEvidencePages.Count < 2)
        {
            Status = "No previous verified Managed Run evidence page";
            return Task.CompletedTask;
        }
        return RunRequestAsync(
            "Returning to previous verified Managed Run evidence page",
            (controller, workspace, token) =>
            {
                if (!StringComparer.Ordinal.Equals(managedEvidenceWorkspace, workspace))
                {
                    throw new ArgumentException(
                        "The workspace changed after the evidence snapshot was loaded. Load the first page again.");
                }
                managedEvidencePages.RemoveAt(managedEvidencePages.Count - 1);
                return Task.FromResult(ProductWorkflowController.RenderManagedEvidencePage(managedEvidencePages[^1]));
            },
            cancellationToken);
    }

    private Task NextManagedEvidencePageAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        if (managedEvidencePages.Count == 0)
        {
            Status = "Managed Run evidence snapshot is not loaded";
            Output = "Load the first verified page before requesting the next page.";
            return Task.CompletedTask;
        }
        var firstPage = managedEvidencePages[0];
        var currentPage = managedEvidencePages[^1];
        if (!currentPage.HasMore)
        {
            Status = "No later Managed Run evidence page exists in this snapshot";
            return Task.CompletedTask;
        }
        return RunRequestAsync(
            "Loading next verified Managed Run evidence page",
            async (controller, workspace, token) =>
            {
                if (!StringComparer.Ordinal.Equals(managedEvidenceWorkspace, workspace))
                {
                    throw new ArgumentException(
                        "The workspace changed after the evidence snapshot was loaded. Load the first page again.");
                }
                if (!ReferenceEquals(currentPage, managedEvidencePages[^1]))
                {
                    throw new ArgumentException(
                        "The evidence page changed before navigation. Load the first page again.");
                }
                var nextPage = await controller.ListManagedEvidencePageAsync(
                    offset: currentPage.Offset + currentPage.Items.Count,
                    limit: currentPage.Limit,
                    snapshotDigest: firstPage.SnapshotDigest,
                    expectedTotal: firstPage.Total,
                    cancellationToken: token);
                managedEvidencePages.Add(nextPage);
                return ProductWorkflowController.RenderManagedEvidencePage(nextPage);
            },
            cancellationToken);
    }

    private Task ReadManagedEvidenceAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Reading exact Managed Run evidence",
            (controller, _, token) => controller.ReadManagedEvidenceAsync(ManagedRunId, token),
            cancellationToken);

    private Task LoadManagedReviewAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Loading exact staged Managed Run review",
            async (controller, workspace, token) =>
            {
                var preview = await controller.ReadManagedReviewAsync(ManagedReviewRunId, token);
                managedReviewPreview = preview;
                managedReviewWorkspace = workspace;
                return ProductWorkflowController.RenderManagedReviewPreview(preview);
            },
            cancellationToken);

    private Task ApplyManagedReviewAsync(object? commandParameter, CancellationToken cancellationToken) =>
        DecideManagedReviewAsync(apply: true, cancellationToken);

    private Task DiscardManagedReviewAsync(object? commandParameter, CancellationToken cancellationToken) =>
        DecideManagedReviewAsync(apply: false, cancellationToken);

    private Task DecideManagedReviewAsync(bool apply, CancellationToken cancellationToken)
    {
        var preview = managedReviewPreview;
        if (preview is null)
        {
            Status = "Managed staged review is not loaded";
            Output = "Load and review one exact pending staged Managed Run before choosing apply or discard.";
            return Task.CompletedTask;
        }
        if (apply && !preview.CanApply)
        {
            Status = "Exact apply is unavailable";
            Output = "This verified review state does not expose an exact apply confirmation. Discard or reload current state.";
            return Task.CompletedTask;
        }
        if (!apply && !preview.CanDiscard)
        {
            Status = "Exact discard is unavailable";
            Output = "This verified review state does not expose a discard decision. Reload current state.";
            return Task.CompletedTask;
        }
        var decisionLabel = apply ? "apply" : "discard";
        var firstConfirmation =
            $"Choose exact {decisionLabel} for Managed Run {preview.ManagedRunId:D} revision {preview.ManagedRunRevision}?\n\n" +
            $"Changes: {preview.Staging.ChangeCount}; inventory: {preview.Staging.ChangedInventoryDigest}; " +
            $"preview: {preview.PreviewDigest}.\n\n" +
            (apply
                ? "Apply can change only the exact reviewed workspace-relative inventory and host-owned write envelope. Post-apply Workflow gates will be recorded not assessed, so governed outcome success cannot be claimed."
                : "Discard persists governed discarded state. Machine-local stage and recovery-journal cleanup remain separate, unproven claims.");
        var secondConfirmation =
            $"Final exact {decisionLabel} confirmation for Managed Run {preview.ManagedRunId:D}?\n\n" +
            $"Bound revision: {preview.ManagedRunRevision}\nPreview: {preview.PreviewDigest}\n" +
            $"Inventory: {preview.Staging.ChangedInventoryDigest}\n\n" +
            (apply
                ? $"Write envelope: {string.Join(", ", preview.ApplyConfirmation?.WriteEnvelope ?? [])}. This can mutate only those exact source-workspace scopes. Workflow gates remain not assessed."
                : "Persisted discard does not independently prove machine-local stage or recovery-journal cleanup. Cancel keeps the review pending.");
        return RunRequestAsync(
            apply ? "Applying exact reviewed inventory" : "Discarding exact staged review",
            async (controller, workspace, token) =>
            {
                if (!StringComparer.Ordinal.Equals(managedReviewWorkspace, workspace))
                {
                    throw new ArgumentException(
                        "The workspace changed after the staged review was loaded. Load and review it again.");
                }
                if (!ReferenceEquals(preview, managedReviewPreview))
                {
                    throw new ArgumentException(
                        "The staged review changed before the decision. Load and review it again.");
                }
                managedReviewPreview = null;
                managedReviewWorkspace = null;
                var actorId = Environment.GetEnvironmentVariable("GAEP_ACTOR_ID") ?? "gaep.visual-studio-local-human";
                var transition = apply
                    ? await controller.ApplyManagedReviewAsync(preview, actorId, token)
                    : await controller.DiscardManagedReviewAsync(preview, actorId, token);
                return ProductWorkflowController.RenderManagedReviewTransition(transition);
            },
            cancellationToken,
            confirmationMessage: firstConfirmation,
            secondConfirmationMessage: secondConfirmation);
    }

    private Task ListDesignImportsAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Listing design imports",
            (controller, _, token) => controller.ListPortableDesignSnapshotsAsync(token),
            cancellationToken);

    private Task ReadDesignImportAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Reading design import",
            (controller, _, token) => controller.ReadPortableDesignSnapshotAsync(BundleId, token),
            cancellationToken);

    private Task ImportDesignBundleAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        var actorId = Environment.GetEnvironmentVariable("GAEP_ACTOR_ID") ?? "gaep.visual-studio-local-human";
        return RunRequestAsync(
            "Importing local bundle",
            (controller, _, token) => controller.ImportPortableDesignSnapshotAsync(BundlePath, actorId, token),
            cancellationToken,
            confirmationMessage:
                "Import one local folder as metadata and digests only? The result remains pending human review even when upstream sourceReview says approved.");
    }

    private InitiativeClassificationInput BuildInitiativeClassificationInput()
    {
        var editor = InitiativeClassification;
        if (!bool.TryParse(editor.Regulated, out var regulated))
        {
            throw new ArgumentException("Regulated must be selected explicitly as true or false.");
        }
        return new InitiativeClassificationInput(
            editor.PrimaryType,
            ParseInitiativeEntries(editor.SecondaryTypes),
            editor.SystemState,
            editor.ChangePosture,
            ParseInitiativeEntries(editor.Motivations),
            new InitiativeClassificationCharacteristics(
                editor.UserInterface,
                editor.Data,
                editor.Integration,
                ParseInitiativeEntries(editor.InteractionModes),
                editor.Exposure),
            regulated,
            ParseInitiativeEntries(editor.PolicyDomains),
            ParseInitiativeEntries(editor.Sensitivities),
            editor.ExpectedLifetime,
            editor.MaintenanceHorizon,
            new InitiativeClassificationRisk(
                editor.BlastRadius,
                editor.Reversibility,
                editor.Urgency,
                editor.CostOfFailure),
            ParseInitiativeEntries(editor.Dependencies),
            ParseInitiativeEntries(editor.AffectedAssets),
            editor.Owner,
            editor.AccountableAuthority,
            new InitiativeClassificationConfidence(editor.ConfidenceLevel, editor.ConfidenceBasis),
            ParseInitiativeSources(editor.Evidence),
            ParseInitiativeEntries(editor.UnresolvedQuestions),
            editor.Rationale);
    }

    private InitiativeApplicabilityDecisionInput BuildInitiativeDecisionInput()
    {
        var editor = InitiativeDecision;
        var decided = editor.ApprovalState is "approved" or "rejected";
        return new InitiativeApplicabilityDecisionInput(
            new InitiativeApplicabilitySubject(editor.SubjectType, editor.SubjectKey, editor.SubjectLabel),
            editor.Status,
            editor.Rationale,
            ParseInitiativeSources(editor.Sources),
            editor.Owner,
            EmptyToNull(editor.AccountableApprover),
            ParseInitiativeEntries(editor.Dependencies),
            ParseInitiativeEntries(editor.Conditions),
            ParseInitiativeEntries(editor.ReviewTriggers),
            new InitiativeApplicabilityApproval(
                editor.ApprovalState,
                ParseInitiativeEntries(editor.ApprovalConditions),
                decided ? CurrentActorId() : null,
                decided ? DateTimeOffset.UtcNow : null),
            ParseInitiativeRelatedRecords(editor.RelatedRecords),
            ParseInitiativeEntries(editor.RelatedImplementationUnits));
    }

    private InitiativeUnresolvedSubject BuildInitiativeUnresolvedSubject()
    {
        var editor = InitiativeUnresolved;
        return new InitiativeUnresolvedSubject(
            new InitiativeApplicabilitySubject(editor.SubjectType, editor.SubjectKey, editor.SubjectLabel),
            editor.Reason,
            editor.Owner);
    }

    private static IReadOnlyList<string> ParseInitiativeEntries(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? Array.Empty<string>()
            : Array.AsReadOnly(value
                .Split([',', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToArray());

    private static IReadOnlyList<InitiativeEntrySource> ParseInitiativeSources(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return Array.Empty<InitiativeEntrySource>();
        return Array.AsReadOnly(value
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(line =>
            {
                var fields = line.Split('|', StringSplitOptions.TrimEntries);
                if (fields.Length is < 2 or > 3 || fields.Any(string.IsNullOrWhiteSpace))
                {
                    throw new ArgumentException(
                        "Each Initiative source must be one line: kind | portable reference | optional sha256 digest.");
                }
                return new InitiativeEntrySource(fields[0], fields[1], fields.Length == 3 ? fields[2] : null);
            })
            .ToArray());
    }

    private static IReadOnlyList<InitiativeRelatedRecord> ParseInitiativeRelatedRecords(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return Array.Empty<InitiativeRelatedRecord>();
        return Array.AsReadOnly(value
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(line =>
            {
                var fields = line.Split('|', StringSplitOptions.TrimEntries);
                if (fields.Length != 4 || !Guid.TryParseExact(fields[1], "D", out var recordId) || recordId == Guid.Empty ||
                    !long.TryParse(fields[2], out var revision))
                {
                    throw new ArgumentException(
                        "Each related record must be one line: record type | UUID | revision | sha256 digest.");
                }
                return new InitiativeRelatedRecord(fields[0], recordId, revision, fields[3]);
            })
            .ToArray());
    }

    private void EnsureInitiativeWorkspace(string workspace, InitiativeEntryContext context)
    {
        if (!StringComparer.Ordinal.Equals(initiativeEntryWorkspace, workspace))
        {
            throw new ArgumentException("The workspace changed after the Initiative entry was loaded. Load it again.");
        }
        if (!ReferenceEquals(context, initiativeEntryContext))
        {
            throw new ArgumentException("The Initiative entry changed while the form was open. Load and review it again.");
        }
    }

    private void RefreshInitiativeDraftSummary()
    {
        var coverage = initiativeEntryContext?.Assessment.Applicability.Coverage;
        var summary = new List<string>
        {
            $"Local applicability draft: {initiativeDraftDecisions.Count} decision(s), " +
            $"{initiativeDraftUnresolved.Count} unresolved subject(s). No governed state has changed.",
        };
        if (coverage?.CatalogVersion is not null)
        {
            summary.Add(
                $"Catalog binding: {coverage.CatalogVersion}; {coverage.SubjectCount} canonical subject(s); " +
                $"{coverage.CoveredSubjectCount} currently covered.");
        }
        summary.AddRange(initiativeDraftDecisions.Select((decision, index) =>
            $"Decision {index + 1}: {decision.Subject.Type}/{decision.Subject.Key} — {decision.Status}"));
        summary.AddRange(initiativeDraftUnresolved.Select((unresolved, index) =>
            $"Unresolved {index + 1}: {unresolved.Subject.Type}/{unresolved.Subject.Key}"));
        InitiativeDraftSummary = string.Join(Environment.NewLine, summary);
    }

    private InitiativeApplicabilitySubjectCatalogBinding LoadedInitiativeSubjectCatalog()
    {
        var coverage = initiativeEntryContext?.Assessment.Applicability.Coverage;
        if (coverage?.CatalogVersion is null || coverage.CatalogDigest is null || coverage.SubjectCount < 1)
        {
            throw new ArgumentException(
                "Load an exact Initiative entry with a current applicability subject catalog before editing the matrix.");
        }
        return new InitiativeApplicabilitySubjectCatalogBinding(
            coverage.CatalogVersion,
            coverage.CatalogDigest,
            coverage.SubjectCount);
    }

    private static Guid ParseInitiativeId(string value)
    {
        if (!Guid.TryParseExact(value?.Trim(), "D", out var initiativeId) || initiativeId == Guid.Empty)
        {
            throw new ArgumentException("Initiative ID must be a non-empty UUID.");
        }
        return initiativeId;
    }

    private static string CurrentActorId() =>
        Environment.GetEnvironmentVariable("GAEP_ACTOR_ID") ?? "gaep.visual-studio-local-human";

    private static string? EmptyToNull(string value) => string.IsNullOrWhiteSpace(value) ? null : value;

    private void ConfigureAgentSelection(AgentSelectionContext context)
    {
        AvailableAgentChoices = context.Available.Select(AgentChoice).ToArray();
        var current = context.Current.Selection;
        var preferred = current is null
            ? AvailableAgentChoices.First()
            : context.Available.Where(snapshot => snapshot.AdapterId == current.AdapterId)
                .Select(AgentChoice)
                .FirstOrDefault() ?? AvailableAgentChoices.First();
        SelectedAgentChoice = preferred;
        if (current is not null && ResolveSelectedAgent(context).AdapterId == current.AdapterId)
        {
            SelectedModelId = current.ModelId;
            foreach (var editor in AgentSettingInputs)
            {
                if (current.Settings.TryGetValue(editor.Key, out var value)) editor.Value = RenderSettingValue(value);
            }
        }
    }

    private void RebuildAgentSelectionEditors()
    {
        var context = agentSelectionContext;
        if (context is null || string.IsNullOrEmpty(SelectedAgentChoice))
        {
            AvailableModelIds = [];
            SelectedModelId = string.Empty;
            AgentSettingInputs = [];
            return;
        }
        var snapshot = ResolveSelectedAgent(context);
        AvailableModelIds = snapshot.Models.Select(model => model.Id).ToArray();
        SelectedModelId = AvailableModelIds.FirstOrDefault() ?? string.Empty;
        AgentSettingInputs = snapshot.Settings
            .Where(setting => !setting.Sensitive)
            .Select(setting => new AgentSettingEditorData(
                setting.Key,
                setting.Label,
                setting.Description,
                SettingInputHint(setting)))
            .ToArray();
    }

    private AgentReadinessSnapshot ResolveSelectedAgent(AgentSelectionContext context) =>
        context.Available.SingleOrDefault(snapshot => AgentChoice(snapshot) == SelectedAgentChoice)
        ?? throw new ArgumentException("Select one verified adapter from the loaded capability snapshot.");

    private void RebuildAccessibleSortColumns()
    {
        var table = accessibleTables.SingleOrDefault(item => AccessibleTableChoice(item) == SelectedAccessibleTable);
        if (table is null)
        {
            AvailableAccessibleSortColumns = [];
            SelectedAccessibleSortColumn = string.Empty;
            return;
        }
        AvailableAccessibleSortColumns = [
            "Keep verified source order",
            .. table.Columns.Select(AccessibleSortChoice),
        ];
        SelectedAccessibleSortColumn = AvailableAccessibleSortColumns[0];
        SelectedAccessibleSortDirection = "Ascending";
    }

    private static string AccessibleTableChoice(AccessibleMetadataTable table) =>
        $"{table.Title} — {table.Rows.Count} verified row{(table.Rows.Count == 1 ? string.Empty : "s")}; " +
        $"{table.Omitted} omitted upstream";

    private static string AccessibleSortChoice(AccessibleTableColumn column) => $"Sort by {column.Label}";

    private static string ChangeChoice(ChangeImpactChangeReference change) =>
        $"{change.RecordId:D} · {change.State} · revision {change.Revision} · " +
        string.Join(", ", change.EffectEnvelope);

    private static string AgentChoice(AgentReadinessSnapshot snapshot) =>
        $"{snapshot.AgentLabel} — {snapshot.AdapterId} ({snapshot.ExecutionInterface}, {snapshot.InterfaceMaturity})";

    private static string SettingInputHint(AgentSelectionSetting setting)
    {
        var defaultText = setting.DefaultValue is null ? "no explicit override" : RenderSettingValue(setting.DefaultValue);
        return setting.Kind switch
        {
            "select" => $"Allowed: {string.Join(", ", setting.Options?.Select(option => option.Value) ?? [])}. Leave blank for {defaultText}.",
            "boolean" => $"Enter true or false. Leave blank for {defaultText}.",
            "number" => $"Enter a finite number{NumberBounds(setting)}. Leave blank for {defaultText}.",
            "string-list" => $"Enter comma-separated non-empty values. Leave blank for {defaultText}.",
            _ => $"Enter portable text without paths or secrets. Leave blank for {defaultText}.",
        };
    }

    private static string NumberBounds(AgentSelectionSetting setting)
    {
        if (setting.Minimum.HasValue && setting.Maximum.HasValue) return $" from {setting.Minimum} to {setting.Maximum}";
        if (setting.Minimum.HasValue) return $" of at least {setting.Minimum}";
        return setting.Maximum.HasValue ? $" of at most {setting.Maximum}" : string.Empty;
    }

    private static string RenderSettingValue(PortableAgentSettingValue value) => value switch
    {
        PortableAgentText text => text.Value,
        PortableAgentNumber number => number.Value.ToString(System.Globalization.CultureInfo.InvariantCulture),
        PortableAgentBoolean boolean => boolean.Value.ToString().ToLowerInvariant(),
        PortableAgentTextList list => string.Join(", ", list.Value),
        _ => string.Empty,
    };

    private async Task RunRequestAsync(
        string label,
        Func<ProductWorkflowController, string, CancellationToken, Task<string>> action,
        CancellationToken cancellationToken,
        string? confirmationMessage = null,
        string? secondConfirmationMessage = null)
    {
        if (!await requestGate.WaitAsync(0, cancellationToken))
        {
            Status = "A GAEP request is already running";
            return;
        }
        Busy = true;
        Status = $"{label}…";
        try
        {
            if (confirmationMessage is not null)
            {
                var confirmed = await extensibility.Shell().ShowPromptAsync(
                    confirmationMessage,
                    PromptOptions.OK.WithCancel(cancelReturns: false, cancelIsDefault: true),
                    cancellationToken);
                if (!confirmed)
                {
                    Status = "Request cancelled; no state changed";
                    return;
                }
            }
            if (secondConfirmationMessage is not null)
            {
                var confirmed = await extensibility.Shell().ShowPromptAsync(
                    secondConfirmationMessage,
                    PromptOptions.OK.WithCancel(cancelReturns: false, cancelIsDefault: true),
                    cancellationToken);
                if (!confirmed)
                {
                    Status = "Final confirmation cancelled; no state changed";
                    return;
                }
            }
            var workspace = ProductWorkflowController.NormalizeWorkspacePath(WorkspacePath);
            await using var client = VisualStudioEngineClientFactory.Create(workspace);
            var controller = new ProductWorkflowController(client);
            Output = await action(controller, workspace, cancellationToken);
            Status = "GAEP engine ready";
        }
        catch (Exception error)
        {
            Status = error is OperationCanceledException ? "GAEP request cancelled" : "GAEP request stopped";
            Output = ProductWorkflowController.SafeError(error);
        }
        finally
        {
            Busy = false;
            requestGate.Release();
        }
    }
}
