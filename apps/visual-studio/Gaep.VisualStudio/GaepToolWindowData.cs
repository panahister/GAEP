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
internal sealed class GaepToolWindowData : NotifyPropertyChangedObject
{
    private readonly VisualStudioExtensibility extensibility;
    private readonly SemaphoreSlim requestGate = new(1, 1);
    private string workspacePath = Environment.GetEnvironmentVariable("GAEP_WORKSPACE_PATH") ?? string.Empty;
    private string bundlePath = string.Empty;
    private string bundleId = string.Empty;
    private string status = "GAEP engine has not been contacted";
    private string output = "Set one absolute local workspace folder, then refresh the Product.";
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

    public GaepToolWindowData(VisualStudioExtensibility extensibility)
    {
        this.extensibility = extensibility ?? throw new ArgumentNullException(nameof(extensibility));
        RefreshProductCommand = new AsyncCommand(RefreshProductAsync);
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
        "Codex and Claude readiness is observation-only. Guarded selection and versioned handoff record portable configuration and history only; they cannot start or resume a provider, create a Run, approve tools or effects, or grant execution authority. Managed read-only execution is a separate exact-digest command: every Tool remains denied, only observation is allowed, and provider completion is reported separately from governed outcome. Managed Run evidence inventory/detail is audit-gated, bounded, private-safe observation only; it cannot start, resume, cancel, apply, discard, approve, or grant outcome authority. Exact staged review is a separate two-confirmation flow bound to one Run revision, preview digest, complete changed-file inventory, and host-owned write envelope; post-apply gates remain not assessed and persisted state does not prove cleanup. Portable-design imports remain pending human review. Upstream approval is not GAEP approval, a Design Baseline, implementation readiness, or release readiness. Only validated metadata and digests are displayed.";

    [DataMember]
    public IAsyncCommand RefreshProductCommand { get; }

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
            await using var client = new EngineClient(workspace);
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
