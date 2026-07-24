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
        "Codex and Claude readiness is observation-only. Guarded selection and versioned handoff record portable configuration and history only; they cannot start or resume a provider, create a Run, approve tools or effects, or grant execution authority. Portable-design imports remain pending human review. Upstream approval is not GAEP approval, a Design Baseline, implementation readiness, or release readiness. Only validated metadata and digests are displayed.";

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
        string? confirmationMessage = null)
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
