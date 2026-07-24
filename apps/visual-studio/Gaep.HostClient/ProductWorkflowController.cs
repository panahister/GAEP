using System.Globalization;
using System.Text;

namespace Gaep.HostClient;

public sealed record AgentSelectionContext(
    AgentSelectionState Current,
    IReadOnlyList<AgentReadinessSnapshot> Available);

public sealed record AgentHandoffContext(
    AgentSelection Current,
    AgentRun SourceRun,
    IReadOnlyList<AgentReadinessSnapshot> Available);

public sealed class ProductWorkflowController(EngineClient client)
{
    public async Task<string> ReadProductAsync(CancellationToken cancellationToken = default) =>
        RenderProduct(await client.ReadProductBindingAsync(cancellationToken));

    public async Task<string> ReadAgentReadinessAsync(CancellationToken cancellationToken = default)
    {
        var snapshots = await client.ProbeAgentReadinessAsync(cancellationToken);
        var output = new StringBuilder()
            .AppendLine("GAEP Codex and Claude readiness")
            .AppendLine()
            .AppendLine("Observation only: this view cannot select a model, change settings, start an agent, resume work, or grant execution authority.")
            .AppendLine("Only verified, path-free capability metadata is shown. Executable paths, provider credentials, and raw engine output are withheld.");
        foreach (var snapshot in snapshots)
        {
            output.AppendLine().Append(RenderAgentReadiness(snapshot));
        }
        return output.ToString();
    }

    public async Task<AgentSelectionContext> ReadAgentSelectionContextAsync(
        CancellationToken cancellationToken = default)
    {
        var current = await client.ReadAgentSelectionAsync(cancellationToken);
        if (current.Status == AgentSelectionStatus.MigrationRequired)
        {
            throw new ArgumentException(
                "The existing legacy Agent Selection requires explicit migration review. Visual Studio will not overwrite it implicitly.");
        }
        if (current.Status == AgentSelectionStatus.Invalid)
        {
            throw new ArgumentException(
                "The existing Agent Selection is invalid. Repair or review the governed record before selecting another agent.");
        }
        var available = (await client.ProbeAgentReadinessAsync(cancellationToken))
            .Where(snapshot => snapshot.Detected && snapshot.ExecutionInterface != "unavailable")
            .ToArray();
        if (available.Length == 0)
        {
            throw new ArgumentException("No verified local Codex or Claude adapter is currently available for selection.");
        }
        return new AgentSelectionContext(current, Array.AsReadOnly(available));
    }

    public async Task<string> SelectAgentAsync(
        string adapterId,
        string modelId,
        IReadOnlyDictionary<string, PortableAgentSettingValue> settings,
        string actorId,
        CancellationToken cancellationToken = default) =>
        RenderAgentSelection(await client.SelectAgentAsync(
            adapterId,
            modelId,
            settings,
            actorId,
            cancellationToken));

    public async Task<AgentHandoffContext> ReadAgentHandoffContextAsync(
        CancellationToken cancellationToken = default)
    {
        var state = await client.ReadAgentSelectionAsync(cancellationToken);
        var current = state.Status switch
        {
            AgentSelectionStatus.Selected when state.Selection is not null => state.Selection,
            AgentSelectionStatus.Unselected => throw new ArgumentException(
                "No prior Agent Selection exists. Use guarded selection before creating Runs or handoffs."),
            AgentSelectionStatus.MigrationRequired => throw new ArgumentException(
                "The existing legacy Agent Selection requires explicit migration review before a versioned handoff."),
            _ => throw new ArgumentException(
                "The existing Agent Selection is invalid. Repair or review the governed record before creating a handoff."),
        };
        var runs = await client.ListRunsAsync(cancellationToken);
        var active = runs.Where(run => !IsTerminalRun(run)).ToArray();
        if (active.Length > 0)
        {
            throw new ArgumentException(
                $"A versioned handoff cannot be created while {active.Length} Run(s) are non-terminal. Stop, cancel, or reconcile the Run first.");
        }
        var sourceRun = runs.FirstOrDefault()
            ?? throw new ArgumentException("No prior terminal Run exists to bind as the source of a versioned handoff.");
        if (!SamePortableBinding(sourceRun.Agent, current))
        {
            throw new ArgumentException(
                "The latest terminal Run is not bound to the current Agent Selection. Refresh or reconcile governed state before handing off.");
        }
        var available = (await client.ProbeAgentReadinessAsync(cancellationToken))
            .Where(snapshot => snapshot.Detected && snapshot.ExecutionInterface != "unavailable")
            .ToArray();
        if (available.Length == 0)
        {
            throw new ArgumentException("No verified local Codex or Claude adapter is currently available for handoff.");
        }
        return new AgentHandoffContext(current, sourceRun, Array.AsReadOnly(available));
    }

    public async Task<string> CreateAgentHandoffAsync(
        AgentHandoffContext context,
        string toAdapterId,
        string toModelId,
        IReadOnlyDictionary<string, PortableAgentSettingValue> toSettings,
        string reason,
        IReadOnlyList<string> completedWork,
        IReadOnlyList<string> unresolvedMatters,
        IReadOnlyList<string> decisions,
        IReadOnlyList<string> evidence,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (SamePortableBinding(context.Current, toAdapterId, toModelId, toSettings))
        {
            throw new ArgumentException(
                "The handoff target is identical to the current portable Agent Selection. Choose a different adapter, model, or setting.");
        }
        if (completedWork.Count == 0 && unresolvedMatters.Count == 0 && decisions.Count == 0 && evidence.Count == 0)
        {
            throw new ArgumentException(
                "Record at least one completed-work, unresolved-matter, decision, or portable evidence entry before creating a handoff.");
        }
        var freshSelection = await client.ReadAgentSelectionAsync(cancellationToken);
        var freshRuns = await client.ListRunsAsync(cancellationToken);
        var freshSource = freshRuns.FirstOrDefault();
        if (freshSelection.Status != AgentSelectionStatus.Selected || freshSelection.Selection is null ||
            !SameExactSelection(freshSelection.Selection, context.Current) || freshRuns.Any(run => !IsTerminalRun(run)) ||
            freshSource is null || !SameExactRun(freshSource, context.SourceRun) ||
            !SamePortableBinding(freshSource.Agent, context.Current))
        {
            throw new ArgumentException(
                "Agent Selection or Run history changed while the handoff form was open. No handoff was requested; reopen the flow and review fresh state.");
        }
        var target = context.Available.SingleOrDefault(snapshot => snapshot.AdapterId == toAdapterId)
            ?? throw new ArgumentException("Select one verified adapter from the loaded handoff capability snapshot.");
        var handoff = await client.CreateHandoffAsync(
            context.SourceRun.Id,
            context.SourceRun.ProductId,
            context.SourceRun.InitiativeId,
            toAdapterId,
            target.AgentId,
            toModelId,
            toSettings,
            reason,
            completedWork,
            unresolvedMatters,
            decisions,
            evidence,
            actorId,
            cancellationToken);
        return RenderAgentHandoff(handoff);
    }

    public Task<ManagedReadOnlyPreview> PreviewManagedReadOnlyAsync(
        string charterId,
        string workflowPlanId,
        CancellationToken cancellationToken = default) =>
        client.PreviewManagedReadOnlyAsync(
            ParseRequiredId(charterId, "Charter ID"),
            ParseRequiredId(workflowPlanId, "Workflow Plan ID"),
            cancellationToken);

    public static string RenderManagedReadOnlyPreview(ManagedReadOnlyPreview preview)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP managed read-only execution preview")
            .AppendLine()
            .AppendLine($"Exact preview digest: {preview.PreviewDigest}")
            .AppendLine($"Product: {preview.ProductId:D}")
            .AppendLine($"Initiative: {preview.InitiativeId:D}")
            .AppendLine($"Charter: {preview.CharterId:D}")
            .AppendLine($"Charter digest: {preview.CharterDigest}")
            .AppendLine($"Workflow Plan: {preview.WorkflowPlanId:D}")
            .AppendLine($"Workflow Plan digest: {preview.WorkflowPlanDigest}")
            .AppendLine($"Provider binding: {preview.AgentId} / {preview.ModelId} ({preview.AdapterId})")
            .AppendLine($"Selection digest: {preview.SelectionDigest}")
            .AppendLine($"Strategy: {preview.Strategy}")
            .AppendLine($"Steps: {preview.StepIds.Count}")
            .AppendLine($"Context packs: {preview.ContextPackCount}")
            .AppendLine($"Declared reads: {preview.ReadScopeCount}")
            .AppendLine($"Evidence and stop gates: {preview.Gates.Count}");
        foreach (var gate in preview.Gates)
        {
            output.AppendLine($"  - {gate.Key} [{gate.Phase}]{(gate.StepId.HasValue ? $"; step={gate.StepId.Value:D}" : string.Empty)}")
                .AppendLine($"    Criteria digest: {gate.CriteriaDigest}");
            if (gate.Criteria.Count == 0) output.AppendLine("    Criteria: none declared");
            foreach (var criterion in gate.Criteria) output.AppendLine($"    - {criterion}");
        }
        return output.AppendLine()
            .AppendLine($"Authority boundary: {preview.AuthorityBoundary}")
            .AppendLine("Every Tool permission is denied. No tool definitions, write scopes, or non-observation effects are granted.")
            .Append("This preview does not execute work; the exact digest must be attested separately.")
            .ToString();
    }

    public async Task<string> ExecuteManagedReadOnlyAsync(
        ManagedReadOnlyPreview preview,
        string actorId,
        int timeoutMs = 120_000,
        CancellationToken cancellationToken = default) =>
        RenderManagedReadOnlyReceipt(await client.ExecuteManagedReadOnlyAsync(
            preview,
            timeoutMs,
            actorId,
            cancellationToken));

    public static string NormalizeHandoffReason(string value) =>
        PortableDesignProtocol.ValidateHandoffText(value, "Handoff reason", 2, 5_000);

    public static IReadOnlyList<string> BuildHandoffTextList(string value, string label)
    {
        if (string.IsNullOrWhiteSpace(value)) return Array.Empty<string>();
        return PortableDesignProtocol.ValidateHandoffTextList(
            value.Split(',', StringSplitOptions.TrimEntries),
            label);
    }

    public static IReadOnlyDictionary<string, PortableAgentSettingValue> BuildAgentSelectionSettings(
        AgentReadinessSnapshot snapshot,
        IReadOnlyDictionary<string, string> inputs)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(inputs);
        var declarations = snapshot.Settings.ToDictionary(setting => setting.Key, StringComparer.Ordinal);
        if (inputs.Keys.Any(key => !declarations.ContainsKey(key)))
        {
            throw new ArgumentException("Agent settings include an undeclared key.", nameof(inputs));
        }
        var values = new Dictionary<string, PortableAgentSettingValue>(StringComparer.Ordinal);
        foreach (var setting in snapshot.Settings)
        {
            if (setting.Sensitive)
            {
                throw new ArgumentException(
                    $"{setting.Label} requires a machine-local credential binding, which this portable Visual Studio selection flow does not collect or store.");
            }
            var raw = inputs.TryGetValue(setting.Key, out var supplied) ? supplied : string.Empty;
            if (string.IsNullOrWhiteSpace(raw) && (!setting.Required || setting.DefaultValue is not null)) continue;
            if (string.IsNullOrWhiteSpace(raw)) throw new ArgumentException($"{setting.Label} is required.");
            values[setting.Key] = setting.Kind switch
            {
                "select" => ParseSelectSetting(setting, raw),
                "boolean" => bool.TryParse(raw, out var boolean)
                    ? new PortableAgentBoolean(boolean)
                    : throw new ArgumentException($"{setting.Label} must be true or false."),
                "number" => ParseNumberSetting(setting, raw),
                "string" => new PortableAgentText(
                    PortableDesignProtocol.ValidatePortableSettingInput(raw, setting.Label, minimum: 1)),
                "string-list" => ParseStringListSetting(setting, raw),
                _ => throw new ArgumentException($"{setting.Label} has an unsupported portable setting kind."),
            };
        }
        return new System.Collections.ObjectModel.ReadOnlyDictionary<string, PortableAgentSettingValue>(values);
    }

    public async Task<string> ListPortableDesignSnapshotsAsync(CancellationToken cancellationToken = default)
    {
        var page = await client.ListPortableDesignSnapshotsAsync(cancellationToken: cancellationToken);
        var output = new StringBuilder()
            .AppendLine($"Portable design metadata: {page.Items.Count} of {page.Total}")
            .AppendLine($"Governance: {page.GovernanceBoundary}")
            .Append($"Privacy: {page.PrivacyBoundary}");
        if (page.Items.Count == 0)
        {
            output.AppendLine().AppendLine().Append("No snapshots were found on this page.");
        }
        for (var index = 0; index < page.Items.Count; index++)
        {
            output.AppendLine().AppendLine().AppendLine($"{index + 1}. {page.Items[index].Title}");
            output.Append(RenderSummary(page.Items[index]));
        }
        return output.ToString();
    }

    public async Task<string> ReadPortableDesignSnapshotAsync(
        string bundleId,
        CancellationToken cancellationToken = default)
    {
        var normalized = ParseBundleId(bundleId);
        return RenderSummary(await client.ReadPortableDesignSnapshotAsync(normalized, cancellationToken));
    }

    public async Task<string> ImportPortableDesignSnapshotAsync(
        string bundleRoot,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var normalizedBundleRoot = PortableDesignProtocol.NormalizeBundleRoot(bundleRoot);
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        var initial = await client.ReadProductBindingAsync(cancellationToken);
        var current = await client.ReadProductBindingAsync(cancellationToken);
        if (current.Id != initial.Id || current.Revision != initial.Revision)
        {
            throw PortableDesignProtocol.ProductContextChanged();
        }
        var imported = await client.ImportPortableDesignSnapshotAsync(
            normalizedBundleRoot,
            initial.Id,
            initial.Revision,
            normalizedActorId,
            cancellationToken);
        return new StringBuilder()
            .AppendLine($"Imported into {initial.Name} at exact Product revision {initial.Revision}.")
            .AppendLine("The result remains pending human review; import validation is not approval or a baseline.")
            .Append(RenderSummary(imported))
            .ToString();
    }

    public static string NormalizeWorkspacePath(string workspacePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workspacePath);
        if (workspacePath.Length > 32_768 || workspacePath.Contains('\0') ||
            !Path.IsPathFullyQualified(workspacePath) || IsNetworkPath(workspacePath))
        {
            throw new ArgumentException("Workspace must be an absolute local folder.", nameof(workspacePath));
        }
        var normalized = Path.GetFullPath(workspacePath);
        if (!Directory.Exists(normalized))
        {
            throw new ArgumentException("Workspace must be an existing local folder.", nameof(workspacePath));
        }
        return normalized;
    }

    public static string SafeError(Exception error) => error switch
    {
        OperationCanceledException => "The GAEP request was cancelled.",
        EngineHostException hostError => hostError.Message,
        ArgumentException argumentError => argumentError.Message,
        _ => "The configured local GAEP engine is unavailable. Verify the executable and digest settings, then retry.",
    };

    private static string RenderProduct(ProductBinding product) => new StringBuilder()
        .AppendLine($"Product: {product.Name}")
        .AppendLine($"Product ID: {product.Id:D}")
        .Append($"Revision: {product.Revision}")
        .ToString();

    private static string RenderAgentReadiness(AgentReadinessSnapshot snapshot)
    {
        var output = new StringBuilder()
            .AppendLine(snapshot.AgentLabel)
            .AppendLine($"  Adapter: {snapshot.AdapterId} {snapshot.AdapterVersion}")
            .AppendLine($"  Detected: {YesNo(snapshot.Detected)}")
            .AppendLine($"  Runtime version: {snapshot.RuntimeVersion ?? "not observed"}")
            .AppendLine($"  Interface: {snapshot.ExecutionInterface} ({snapshot.InterfaceMaturity})")
            .AppendLine($"  Capabilities: resume={YesNo(snapshot.SupportsResume)}, cancel={YesNo(snapshot.SupportsCancel)}, checkpoints={YesNo(snapshot.SupportsCheckpoints)}, model discovery={YesNo(snapshot.SupportsModelDiscovery)}, tool selection={YesNo(snapshot.SupportsToolSelection)}")
            .AppendLine($"  Declared settings: {snapshot.SettingsCount}")
            .AppendLine($"  Models observed: {snapshot.Models.Count}");
        var models = snapshot.Models.Take(20).ToArray();
        if (models.Length == 0) output.AppendLine("  - none observed");
        foreach (var model in models)
        {
            output.AppendLine($"  - {model.Label} ({model.Id}; {model.TruthClass}{(model.Alias ? "; alias" : "")})");
        }
        if (snapshot.Models.Count > models.Length)
        {
            output.AppendLine($"  - {snapshot.Models.Count - models.Length} more withheld from this compact view");
        }
        output.AppendLine($"  Limitations: {snapshot.Limitations.Count}");
        var limitations = snapshot.Limitations.Take(20).ToArray();
        if (limitations.Length == 0) output.AppendLine("  - none declared");
        foreach (var limitation in limitations) output.AppendLine($"  - {limitation}");
        if (snapshot.Limitations.Count > limitations.Length)
        {
            output.AppendLine($"  - {snapshot.Limitations.Count - limitations.Length} more withheld from this compact view");
        }
        return output.Append($"  Observed at: {snapshot.ObservedAt.ToString("O", CultureInfo.InvariantCulture)}").ToString();
    }

    private static string RenderAgentSelection(AgentSelection selection)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP guarded Agent Selection")
            .AppendLine()
            .AppendLine($"Agent: {selection.AgentId}")
            .AppendLine($"Adapter: {selection.AdapterId}")
            .AppendLine($"Model: {selection.ModelId}")
            .AppendLine($"Model evidence: {selection.ModelTruthClass}{(selection.ModelAlias == true ? " (alias)" : "")}")
            .AppendLine($"Selected at: {selection.SelectedAt.ToString("O", CultureInfo.InvariantCulture)}")
            .AppendLine($"Portable settings: {selection.Settings.Count}");
        foreach (var (key, value) in selection.Settings) output.AppendLine($"  - {key}: {RenderSettingValue(value)}");
        return output.AppendLine()
            .AppendLine("Boundary: this record does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority.")
            .Append("Machine-local executable paths, credentials, and raw provider output are not included.")
            .ToString();
    }

    private static string RenderAgentHandoff(AgentHandoff handoff)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP versioned Agent Handoff")
            .AppendLine()
            .AppendLine($"Handoff: {handoff.Id:D}")
            .AppendLine($"Source Run: {handoff.FromRunId:D}")
            .AppendLine($"Target: {handoff.ToAgent.AgentId} / {handoff.ToAgent.ModelId}")
            .AppendLine($"Created at: {handoff.CreatedAt.ToString("O", CultureInfo.InvariantCulture)}")
            .AppendLine($"Workspace observation: dirty={(handoff.WorkspaceBaseline.Dirty.HasValue ? handoff.WorkspaceBaseline.Dirty.Value.ToString().ToLowerInvariant() : "unknown")}; changed files={handoff.WorkspaceBaseline.ChangedFiles.Count}; truth={handoff.WorkspaceBaseline.TruthClass ?? "not recorded"}")
            .AppendLine($"Preserved entries: completed={handoff.CompletedWork.Count}; unresolved={handoff.UnresolvedMatters.Count}; decisions={handoff.Decisions.Count}; evidence={handoff.Evidence.Count}")
            .AppendLine("Capability differences:");
        foreach (var difference in handoff.CapabilityDifferences) output.AppendLine($"  - {difference}");
        return output.AppendLine()
            .AppendLine("Boundary: the handoff atomically replaced portable Agent Selection, but did not start or resume a provider, create a Run, approve tools or effects, or grant execution authority.")
            .Append("Machine-local paths, credentials, provider sessions, and raw provider output are not included.")
            .ToString();
    }

    private static string RenderManagedReadOnlyReceipt(ManagedReadOnlyReceipt receipt)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP managed read-only execution receipt")
            .AppendLine()
            .AppendLine($"Governed Run: {receipt.RunId:D}")
            .AppendLine($"Managed Run: {receipt.ManagedRunId:D}")
            .AppendLine($"Exact preview digest: {receipt.PreviewDigest}")
            .AppendLine($"Product: {receipt.ProductId:D}")
            .AppendLine($"Initiative: {receipt.InitiativeId:D}")
            .AppendLine($"Provider binding: {receipt.AgentId} / {receipt.ModelId} ({receipt.AdapterId})")
            .AppendLine($"Mode: {receipt.Mode}")
            .AppendLine($"Governed state: {receipt.State}")
            .AppendLine($"Provider disposition: {receipt.ProviderDisposition}")
            .AppendLine($"Governed outcome: {receipt.OutcomeStatus}")
            .AppendLine($"Outcome basis: {receipt.OutcomeBasis}")
            .AppendLine($"Completed steps: {receipt.CompletedStepCount} of {receipt.TotalStepCount}")
            .AppendLine($"Verified event count: {receipt.EventCount}")
            .AppendLine($"Result digest: {receipt.ResultDigest}")
            .AppendLine($"Evidence digest: {receipt.EvidenceDigest}")
            .AppendLine($"Warnings: {receipt.Warnings.Count}");
        if (receipt.Warnings.Count == 0) output.AppendLine("  - none");
        foreach (var warning in receipt.Warnings) output.AppendLine($"  - {warning}");
        return output.AppendLine($"Started: {receipt.StartedAt.ToString("O", CultureInfo.InvariantCulture)}")
            .AppendLine($"Ended: {receipt.EndedAt.ToString("O", CultureInfo.InvariantCulture)}")
            .AppendLine()
            .AppendLine("Provider completion and governed outcome are separate claims; one never substitutes for the other.")
            .AppendLine($"Authority boundary: {receipt.AuthorityBoundary}")
            .Append("No local paths, credentials, provider sessions, raw provider output, or source bytes are included.")
            .ToString();
    }

    private static PortableAgentSettingValue ParseSelectSetting(AgentSelectionSetting setting, string raw)
    {
        var option = setting.Options?.FirstOrDefault(option => option.Value == raw)
            ?? throw new ArgumentException($"Select one verified value for {setting.Label}.");
        return new PortableAgentText(option.Value);
    }

    private static PortableAgentSettingValue ParseNumberSetting(AgentSelectionSetting setting, string raw)
    {
        if (!double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) || !double.IsFinite(number))
        {
            throw new ArgumentException($"{setting.Label} must be a finite number.");
        }
        if (setting.Minimum.HasValue && number < setting.Minimum.Value)
        {
            throw new ArgumentException($"{setting.Label} must be at least {setting.Minimum.Value.ToString(CultureInfo.InvariantCulture)}.");
        }
        if (setting.Maximum.HasValue && number > setting.Maximum.Value)
        {
            throw new ArgumentException($"{setting.Label} must be at most {setting.Maximum.Value.ToString(CultureInfo.InvariantCulture)}.");
        }
        return new PortableAgentNumber(number);
    }

    private static PortableAgentSettingValue ParseStringListSetting(AgentSelectionSetting setting, string raw)
    {
        var items = raw.Split(',', StringSplitOptions.TrimEntries);
        if (items.Length == 0 || items.Any(string.IsNullOrEmpty))
        {
            throw new ArgumentException($"{setting.Label} must be a comma-separated list of non-empty values.");
        }
        return new PortableAgentTextList(Array.AsReadOnly(items
            .Select(item => PortableDesignProtocol.ValidatePortableSettingInput(item, setting.Label, minimum: 1))
            .ToArray()));
    }

    private static string RenderSettingValue(PortableAgentSettingValue value) => value switch
    {
        PortableAgentText text => text.Value,
        PortableAgentNumber number => number.Value.ToString(CultureInfo.InvariantCulture),
        PortableAgentBoolean boolean => boolean.Value.ToString().ToLowerInvariant(),
        PortableAgentTextList list => string.Join(", ", list.Value),
        _ => "unsupported",
    };

    private static bool IsTerminalRun(AgentRun run) => run.State is
        AgentRunState.Completed or AgentRunState.Failed or AgentRunState.Cancelled;

    private static bool SamePortableBinding(AgentSelection left, AgentSelection right) =>
        SamePortableBinding(left, right.AdapterId, right.ModelId, right.Settings);

    private static bool SamePortableBinding(
        AgentSelection left,
        string adapterId,
        string modelId,
        IReadOnlyDictionary<string, PortableAgentSettingValue> settings) =>
        left.AdapterId == adapterId && left.ModelId == modelId &&
        PortableDesignProtocol.PortableSettingsEqual(left.Settings, settings);

    private static bool SameExactSelection(AgentSelection left, AgentSelection right) =>
        left.SchemaVersion == right.SchemaVersion && left.AdapterId == right.AdapterId && left.AgentId == right.AgentId &&
        left.ModelId == right.ModelId && left.ModelTruthClass == right.ModelTruthClass && left.ModelAlias == right.ModelAlias &&
        left.SelectedAt == right.SelectedAt && left.CapabilityDigest == right.CapabilityDigest &&
        PortableDesignProtocol.PortableSettingsEqual(left.Settings, right.Settings);

    private static bool SameExactRun(AgentRun left, AgentRun right) =>
        left.SchemaVersion == right.SchemaVersion && left.Id == right.Id && left.Revision == right.Revision &&
        left.CharterId == right.CharterId && left.CharterDigest == right.CharterDigest &&
        left.ProductId == right.ProductId && left.InitiativeId == right.InitiativeId &&
        SameExactSelection(left.Agent, right.Agent) && left.State == right.State &&
        left.ProviderSessionRef == right.ProviderSessionRef && left.StartedAt == right.StartedAt &&
        left.EndedAt == right.EndedAt && left.PreviousRunId == right.PreviousRunId;

    private static string YesNo(bool value) => value ? "yes" : "no";

    private static string RenderSummary(PortableDesignSnapshotSummary summary) => new StringBuilder()
        .AppendLine($"Bundle ID: {summary.BundleId:D}")
        .AppendLine($"Product ID: {summary.ProductId:D}")
        .AppendLine($"Initiative ID: {(summary.InitiativeId.HasValue ? summary.InitiativeId.Value.ToString("D") : "not-bound")}")
        .AppendLine($"Classification: {PortableName(summary.Classification)}")
        .AppendLine($"Governance: {summary.Governance.State}; human review required={summary.Governance.HumanReviewRequired.ToString().ToLowerInvariant()}")
        .AppendLine($"Source review: {PortableName(summary.SourceReview.Status)} upstream claim; GAEP approval={summary.SourceReview.GaepApproval.ToString().ToLowerInvariant()}")
        .AppendLine($"Source: {summary.Source.Tool}; {PortableName(summary.Source.ExportMethod)}")
        .AppendLine($"Counts: artifacts={summary.Counts.Artifacts}, normalized tokens={summary.Counts.NormalizedDesignTokens}, validation checks={summary.Counts.ValidationChecks}, limitations={summary.Counts.RecordedLimitations}")
        .AppendLine($"Snapshot digest: {summary.Digests.Snapshot}")
        .AppendLine($"Evidence digest: {summary.Digests.Evidence}")
        .AppendLine($"Manifest digest: {summary.Digests.Manifest}")
        .AppendLine($"Inventory digest: {summary.Digests.ArtifactInventory}")
        .AppendLine($"Source exported: {summary.Timestamps.SourceExportedAt.ToString("O", CultureInfo.InvariantCulture)}")
        .AppendLine($"Imported: {summary.Timestamps.ImportedAt.ToString("O", CultureInfo.InvariantCulture)}")
        .Append($"Privacy: {summary.PrivacyBoundary}")
        .ToString();

    private static Guid ParseBundleId(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (!Guid.TryParseExact(value.Trim(), "D", out var bundleId) || bundleId == Guid.Empty)
        {
            throw new ArgumentException("Bundle ID must be a non-empty UUID.", nameof(value));
        }
        return bundleId;
    }

    private static Guid ParseRequiredId(string value, string label)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (!Guid.TryParseExact(value.Trim(), "D", out var id) || id == Guid.Empty)
        {
            throw new ArgumentException($"{label} must be a non-empty UUID.", nameof(value));
        }
        return id;
    }

    private static string PortableName<T>(T value) where T : struct, Enum
    {
        var name = value.ToString();
        var output = new StringBuilder(name.Length + 4);
        for (var index = 0; index < name.Length; index++)
        {
            if (index > 0 && char.IsUpper(name[index])) output.Append('-');
            output.Append(char.ToLowerInvariant(name[index]));
        }
        return output.ToString();
    }

    private static bool IsNetworkPath(string path)
    {
        if (path.StartsWith("//", StringComparison.Ordinal) || path.StartsWith("\\\\", StringComparison.Ordinal)) return true;
        return Uri.TryCreate(path, UriKind.Absolute, out var uri) && !uri.IsFile;
    }
}
