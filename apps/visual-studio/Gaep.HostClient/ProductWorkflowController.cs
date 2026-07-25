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

public sealed record ChangeImpactContext(
    ProductBinding Product,
    ChangeImpactChangeCatalog Catalog);

public sealed class ProductWorkflowController(EngineClient client)
{
    public async Task<string> ReadProductAsync(CancellationToken cancellationToken = default) =>
        RenderProduct(await client.ReadProductBindingAsync(cancellationToken));

    public async Task<InitiativeEntryContext> ReadInitiativeEntryContextAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var assessment = await client.AssessInitiativeEntryAsync(initiativeId, cancellationToken);
        if (assessment.InitiativeRevision != initiative.Revision || assessment.ProductId != initiative.ProductId ||
            assessment.ProductId != product.Id || assessment.ProductRevision != product.Revision ||
            assessment.ProductDigest != product.Digest)
        {
            throw new ArgumentException("The Initiative changed while its entry assessment was read. Refresh the exact record.");
        }
        var classificationValid = assessment.Classification.Status switch
        {
            "missing" => initiative.Classification is null && assessment.Classification.Digest is null,
            "current" => initiative.Classification is not null &&
                assessment.Classification.Digest == initiative.Classification.Digest &&
                initiative.Classification.ProductRevision == assessment.ProductRevision &&
                initiative.Classification.ProductDigest == assessment.ProductDigest,
            "stale" => initiative.Classification is not null &&
                assessment.Classification.Digest == initiative.Classification.Digest &&
                (initiative.Classification.ProductRevision != assessment.ProductRevision ||
                 initiative.Classification.ProductDigest != assessment.ProductDigest),
            _ => false,
        };
        if (!classificationValid)
        {
            throw new ArgumentException("The Initiative classification assessment is not bound to the exact current record.");
        }
        var applicabilityValid = assessment.Applicability.Status switch
        {
            "missing" => initiative.Applicability is null && assessment.Applicability.MatrixRevision is null &&
                assessment.Applicability.Digest is null,
            "current" or "stale" => initiative.Applicability is not null &&
                assessment.Applicability.Status == initiative.Applicability.State &&
                assessment.Applicability.MatrixRevision == initiative.Applicability.Revision &&
                assessment.Applicability.Digest == initiative.Applicability.Digest &&
                assessment.Applicability.DecisionCount == initiative.Applicability.DecisionCount &&
                assessment.Applicability.UnresolvedSubjectCount == initiative.Applicability.UnresolvedSubjectCount,
            _ => false,
        };
        if (!applicabilityValid)
        {
            throw new ArgumentException("The Initiative applicability assessment is not bound to the exact current record.");
        }
        return new InitiativeEntryContext(initiative, assessment);
    }

    public async Task<string> ReadInitiativeEntryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default) =>
        RenderInitiativeEntry(await ReadInitiativeEntryContextAsync(initiativeId, cancellationToken));

    public async Task<string> ClassifyInitiativeAsync(
        InitiativeEntryContext context,
        InitiativeClassificationInput input,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.Initiative.State is "completed" or "cancelled")
        {
            throw new ArgumentException($"Terminal Initiative {context.Initiative.State} entry records are immutable.");
        }
        var fresh = await ReadInitiativeEntryContextAsync(context.Initiative.Id, cancellationToken);
        if (!SameInitiativeEntryBinding(fresh, context))
        {
            throw new ArgumentException(
                "The Initiative changed while the classification form was open. Refresh and review the exact revision.");
        }
        var updated = await client.ClassifyInitiativeAsync(
            context.Initiative.Id,
            context.Initiative.Revision,
            input,
            actorId,
            cancellationToken);
        return RenderInitiativeEntry(await ReadInitiativeEntryContextAsync(updated.Id, cancellationToken));
    }

    public async Task<string> ResolveInitiativeApplicabilityAsync(
        InitiativeEntryContext context,
        InitiativeApplicabilityMatrixInput input,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.Initiative.State is "completed" or "cancelled")
        {
            throw new ArgumentException($"Terminal Initiative {context.Initiative.State} entry records are immutable.");
        }
        if (context.Assessment.Classification.Status != "current")
        {
            throw new ArgumentException(
                "Record a classification bound to the current Product revision before resolving applicability.");
        }
        var fresh = await ReadInitiativeEntryContextAsync(context.Initiative.Id, cancellationToken);
        if (!SameInitiativeEntryBinding(fresh, context))
        {
            throw new ArgumentException(
                "The Initiative changed while the applicability form was open. Refresh and review the exact revision.");
        }
        var updated = await client.ResolveInitiativeApplicabilityAsync(
            context.Initiative.Id,
            context.Initiative.Revision,
            input,
            actorId,
            cancellationToken);
        return RenderInitiativeEntry(await ReadInitiativeEntryContextAsync(updated.Id, cancellationToken));
    }

    public static string RenderInitiativeEntry(InitiativeEntryContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var initiative = context.Initiative;
        var assessment = context.Assessment;
        var output = new StringBuilder()
            .AppendLine("GAEP Initiative entry assessment")
            .AppendLine()
            .AppendLine($"Initiative ID: {initiative.Id:D}")
            .AppendLine($"Initiative revision: {initiative.Revision}")
            .AppendLine($"Lifecycle state: {initiative.State}")
            .AppendLine(
                $"Classification: {assessment.Classification.Status}" +
                (initiative.Classification is null
                    ? string.Empty
                    : $" · {initiative.Classification.PrimaryType} / {initiative.Classification.ProductProfile}"))
            .AppendLine(
                $"Applicability: {assessment.Applicability.Status} · matrix revision " +
                (assessment.Applicability.MatrixRevision?.ToString(CultureInfo.InvariantCulture) ?? "not recorded"))
            .AppendLine($"Decisions: {assessment.Applicability.DecisionCount}")
            .AppendLine($"Unresolved subjects: {assessment.Applicability.UnresolvedSubjectCount}")
            .AppendLine($"Awaiting human decisions: {assessment.Applicability.PendingHumanDecisionCount}")
            .AppendLine($"Blocked decisions: {assessment.Applicability.BlockedDecisionCount}")
            .AppendLine($"Pending approvals: {assessment.Applicability.PendingApprovalCount}")
            .AppendLine($"Rejected approvals: {assessment.Applicability.RejectedApprovalCount}")
            .AppendLine($"Assessment: {assessment.State}");
        foreach (var reason in assessment.Reasons) output.AppendLine($"  - {reason}");
        return output.AppendLine()
            .AppendLine(
                "Boundary: entry assessment is read-only and grants no approval, readiness, not-applicable inference, " +
                "or action authority.")
            .Append(
                "Product and Initiative narrative, evidence content, owners, local paths, credentials, and raw engine " +
                "output are withheld from this compact view.")
            .ToString();
    }

    public static InitiativeClassificationInput ValidateInitiativeClassificationInput(
        InitiativeClassificationInput input)
    {
        PortableDesignProtocol.SerializeInitiativeClassificationInput(input);
        return input;
    }

    public static InitiativeApplicabilityMatrixInput ValidateInitiativeApplicabilityInput(
        InitiativeApplicabilityMatrixInput input)
    {
        PortableDesignProtocol.SerializeInitiativeApplicabilityInput(input);
        return input;
    }

    public async Task<string> ReadPhaseDashboardAsync(CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return RenderPhaseDashboard(await client.ReadPhaseDashboardAsync(
            product,
            DeliveryPhaseId.Phase0Foundation,
            cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadPhaseDashboardTablesAsync(
        CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return AccessibleDashboardTables.Phase(await client.ReadPhaseDashboardAsync(
            product,
            DeliveryPhaseId.Phase0Foundation,
            cancellationToken));
    }

    public async Task<ChangeImpactContext> ReadChangeImpactContextAsync(
        CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return new ChangeImpactContext(product, await client.ListChangeImpactChangesAsync(product, cancellationToken));
    }

    public async Task<string> ReadChangeImpactAsync(
        ChangeImpactContext context,
        ChangeImpactChangeReference change,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(change);
        if (!context.Catalog.Items.Contains(change))
        {
            throw new ArgumentException(
                "The selected Change is not part of the verified current catalog. Reload and select the Change again.",
                nameof(change));
        }
        return RenderChangeImpactDashboard(
            await client.ReadChangeImpactAsync(context.Product, change, cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadChangeImpactTablesAsync(
        ChangeImpactContext context,
        ChangeImpactChangeReference change,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(change);
        if (!context.Catalog.Items.Contains(change))
        {
            throw new ArgumentException(
                "The selected Change is not part of the verified current catalog. Reload and select the Change again.",
                nameof(change));
        }
        return AccessibleDashboardTables.ChangeImpact(
            await client.ReadChangeImpactAsync(context.Product, change, cancellationToken));
    }

    public async Task<string> ReadAgentModelAsync(CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return RenderAgentModelDashboard(await client.ReadAgentModelAsync(product, cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadAgentModelTablesAsync(
        CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return AccessibleDashboardTables.AgentModel(await client.ReadAgentModelAsync(product, cancellationToken));
    }

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

    public Task<ManagedRunSummaryPage> ListManagedEvidencePageAsync(
        int offset = 0,
        int limit = 100,
        string? snapshotDigest = null,
        int? expectedTotal = null,
        CancellationToken cancellationToken = default) =>
        client.ListManagedEvidenceAsync(offset, limit, snapshotDigest, expectedTotal, cancellationToken);

    public async Task<string> ListManagedEvidenceAsync(CancellationToken cancellationToken = default) =>
        RenderManagedEvidencePage(await ListManagedEvidencePageAsync(cancellationToken: cancellationToken));

    public static string RenderManagedEvidencePage(ManagedRunSummaryPage page)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP bounded Managed Run evidence")
            .AppendLine()
            .AppendLine($"Snapshot: {page.SnapshotDigest}")
            .AppendLine($"Offset / limit: {page.Offset} / {page.Limit}")
            .AppendLine($"Displayed: {page.Items.Count} of {page.Total}")
            .AppendLine($"Omitted from this page: {page.OmittedCount}")
            .AppendLine($"More pages available: {YesNo(page.HasMore)}");
        if (page.Items.Count == 0) output.AppendLine("No Managed Runs exist in the verified bounded inventory.");
        foreach (var item in page.Items)
        {
            output.AppendLine()
                .AppendLine($"{item.ManagedRunId:D} · {item.State} · {item.Mode}")
                .AppendLine($"  Provider: {item.AdapterId} / {item.AgentId} / {item.ModelId}")
                .AppendLine(
                    $"  Updated: {item.UpdatedAt.ToString("O", CultureInfo.InvariantCulture)}; " +
                    $"recovery={item.RecoveryStatus}; result={(item.HasResult ? "bound" : "not bound")}; " +
                    $"apply decision={(item.HasApplyDecision ? "bound" : "not bound")}");
        }
        return output.AppendLine()
            .AppendLine(
                "Boundary: this audit-gated observation cannot start, resume, cancel, apply, discard, approve, or grant " +
                "Run, Tool, write, effect, outcome, implementation-readiness, or release authority.")
            .Append(
                "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, " +
                "workspace paths, and credentials are withheld.")
            .ToString();
    }

    public async Task<string> ReadManagedEvidenceAsync(
        string managedRunId,
        CancellationToken cancellationToken = default) =>
        RenderManagedEvidenceDetail(await client.ReadManagedEvidenceAsync(
            ParseRequiredId(managedRunId, "Managed Run ID"),
            cancellationToken));

    public Task<ManagedReviewPreview> ReadManagedReviewAsync(
        string managedRunId,
        CancellationToken cancellationToken = default) =>
        client.ReadManagedReviewAsync(ParseRequiredId(managedRunId, "Managed Run ID"), cancellationToken);

    public Task<ManagedReviewTransition> ApplyManagedReviewAsync(
        ManagedReviewPreview preview,
        string actorId,
        CancellationToken cancellationToken = default) =>
        client.ApplyManagedReviewAsync(preview, actorId, cancellationToken);

    public Task<ManagedReviewTransition> DiscardManagedReviewAsync(
        ManagedReviewPreview preview,
        string actorId,
        CancellationToken cancellationToken = default) =>
        client.DiscardManagedReviewAsync(preview, actorId, cancellationToken);

    public static string RenderManagedReviewPreview(ManagedReviewPreview preview)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact staged Managed Run review")
            .AppendLine()
            .AppendLine($"Managed Run: {preview.ManagedRunId:D}")
            .AppendLine($"Governed Run: {preview.RunId:D}")
            .AppendLine($"Revision / state: {preview.ManagedRunRevision} / {preview.State}")
            .AppendLine($"Product / Initiative: {preview.ProductId:D} / {preview.InitiativeId:D}")
            .AppendLine($"Bindings digest: {preview.BindingsDigest}")
            .AppendLine($"Result: {preview.Result.ResultId:D} ({preview.Result.ResultDigest})")
            .AppendLine($"Provider disposition: {preview.Result.ProviderDisposition}")
            .AppendLine($"Governed outcome before decision: {preview.Result.OutcomeStatus} ({preview.Result.OutcomeBasis})")
            .AppendLine($"Evidence: {preview.Staging.EvidenceId:D} ({preview.Staging.EvidenceDigest})")
            .AppendLine($"Stage: {preview.Staging.ApplyState}; baseline={preview.Staging.BaselineDigest}; final={preview.Staging.FinalDigest}")
            .AppendLine(
                $"Complete bounded inventory: {preview.Staging.ChangeCount}/{preview.Staging.ChangedInventoryLimit}; " +
                $"omitted={preview.Staging.OmittedCount}; digest={preview.Staging.ChangedInventoryDigest}")
            .AppendLine(
                $"Excluded staged paths: {preview.Staging.ExcludedPathCount}; set digest={preview.Staging.ExcludedPathSetDigest}")
            .AppendLine(
                $"Apply available: {YesNo(preview.CanApply)}; discard available: {YesNo(preview.CanDiscard)}; " +
                $"local journal observed: {YesNo(preview.HasLocalJournal)}")
            .AppendLine(
                $"Exact write envelope: {(preview.ApplyConfirmation is null ? "not available" : string.Join(", ", preview.ApplyConfirmation.WriteEnvelope))}")
            .AppendLine($"Preview digest: {preview.PreviewDigest}")
            .AppendLine($"Warnings: {(preview.Result.WarningCodes.Count == 0 ? "none" : string.Join(", ", preview.Result.WarningCodes))}")
            .AppendLine()
            .AppendLine("Exact changed-file inventory")
            .AppendLine();
        if (preview.Staging.ChangedInventory.Count == 0) output.AppendLine("No staged workspace file changes were recorded.");
        for (var index = 0; index < preview.Staging.ChangedInventory.Count; index++)
        {
            var change = preview.Staging.ChangedInventory[index];
            output.AppendLine($"{index + 1}. {change.Kind.ToUpperInvariant()} {change.Path}")
                .AppendLine(
                    $"   Before: {change.BeforeDigest ?? "absent"}; {change.BeforeSize ?? 0} byte(s); " +
                    $"mode {(change.BeforeMode.HasValue ? Convert.ToString(change.BeforeMode.Value, 8) : "absent")}")
                .AppendLine(
                    $"   After: {change.AfterDigest ?? "absent"}; {change.AfterSize ?? 0} byte(s); " +
                    $"mode {(change.AfterMode.HasValue ? Convert.ToString(change.AfterMode.Value, 8) : "absent")}");
        }
        return output.AppendLine()
            .AppendLine(
                "Boundary: this view authorizes no mutation. Apply or discard requires a separate exact " +
                "revision-and-preview-digest-bound human decision and a second cancel-default confirmation.")
            .AppendLine(
                "Apply is limited to this exact changed inventory and write envelope. The host records post-apply " +
                "Workflow gates not assessed, so it cannot claim governed outcome satisfaction.")
            .Append(
                "Provider output, prompts, context content, staged source bytes, absolute paths, executable paths, " +
                "process state, workspace paths and credentials are withheld.")
            .ToString();
    }

    public static string RenderManagedReviewTransition(ManagedReviewTransition transition)
    {
        var detail = transition.Detail;
        return new StringBuilder()
            .AppendLine("GAEP managed staged-review transition")
            .AppendLine()
            .AppendLine($"Decision: {transition.Decision}")
            .AppendLine($"Managed Run: {transition.ManagedRunId:D}")
            .AppendLine($"Revision: {transition.SourceManagedRunRevision} -> {transition.ManagedRunRevision}")
            .AppendLine($"Persisted state: {transition.State}")
            .AppendLine($"Source preview: {transition.SourcePreviewDigest}")
            .AppendLine($"Transition digest: {transition.TransitionDigest}")
            .AppendLine($"Apply available: {YesNo(transition.CanApply)}; discard available: {YesNo(transition.CanDiscard)}")
            .AppendLine($"Local journal observed: {YesNo(transition.HasLocalJournal)}")
            .AppendLine($"Result digest: {detail.Summary.ResultDigest ?? "not bound"}")
            .AppendLine($"Apply-decision digest: {detail.Summary.ApplyDecisionDigest ?? "not bound"}")
            .AppendLine($"Provider disposition: {detail.Result?.ProviderDisposition ?? "not available"}")
            .AppendLine(
                $"Governed outcome: {(detail.Result is null ? "not available" : $"{detail.Result.OutcomeStatus} ({detail.Result.OutcomeBasis})")}")
            .AppendLine()
            .Append(
                "Boundary: this receipt proves only the verified persisted transition. Provider completion, governed " +
                "outcome satisfaction, machine-local stage cleanup and recovery-journal cleanup remain separate claims.")
            .ToString();
    }

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

    private static string RenderPhaseDashboard(PhaseDashboardFramework dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP phase-scoped dashboard framework")
            .AppendLine()
            .AppendLine($"Delivery phase: {dashboard.PhaseLabel}")
            .AppendLine($"Exact Product revision: {dashboard.ProductRevision}")
            .AppendLine($"Product digest: {dashboard.ProductDigest}")
            .AppendLine($"Composition digest: {dashboard.CompositionDigest}")
            .AppendLine($"Observed: {dashboard.ObservedAt:O}")
            .AppendLine($"Source: {dashboard.SourceBoundary}")
            .AppendLine($"Evidence freshness: {dashboard.EvidenceCues.Freshness}")
            .AppendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
            .AppendLine();
        foreach (var panel in dashboard.Panels)
        {
            output.AppendLine(
                $"{panel.Title} · {panel.Role} · applicability={panel.Applicability.Status} " +
                $"({panel.Applicability.Basis}) · state={panel.State}");
            if (panel.Applicability.Decision is { } decision)
            {
                output.AppendLine(
                    $"  Decision: {decision.RecordId:D} revision {decision.Revision}; digest={decision.Digest}");
            }
        }
        output.AppendLine();
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output
            .AppendLine()
            .AppendLine(
                "Boundary: this is a read-only governed-state projection. It grants no mutation, applicability, " +
                "phase-entry, approval, readiness, acceptance, release, Run, Tool, or effect authority.")
            .Append(
                "Product text, source bytes, local paths, provider output, prompts, executable state, and credentials are withheld.")
            .ToString();
    }

    private static string RenderChangeImpactDashboard(ChangeImpactDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Change and impact dashboard")
            .AppendLine()
            .AppendLine($"Change: {dashboard.Change.RecordId:D}")
            .AppendLine($"Change revision / state: {dashboard.Change.Revision} / {dashboard.Change.State}")
            .AppendLine($"Change digest: {dashboard.Change.Digest}")
            .AppendLine($"Product revision: {dashboard.ProductRevision}")
            .AppendLine($"Product digest: {dashboard.ProductDigest}")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine($"Effects: {string.Join(", ", dashboard.Change.EffectEnvelope)}")
            .AppendLine(
                $"Freshness: {dashboard.Freshness.State}; observed {dashboard.ObservedAt:O}; " +
                $"trace evaluated {dashboard.Freshness.EvaluatedAt:O}")
            .AppendLine($"Source: {dashboard.SourceBoundary}")
            .AppendLine($"Evidence freshness: {dashboard.EvidenceCues.Freshness}")
            .AppendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
            .AppendLine("Approval: not established. The current contract has no general Change approval record.")
            .AppendLine()
            .AppendLine($"Work Items ({dashboard.Limits.WorkItems.Shown}/{dashboard.Limits.WorkItems.Total}):");
        foreach (var entry in dashboard.WorkItems)
        {
            output.AppendLine(
                $"  {entry.Record.RecordId:D}@{entry.Record.Revision} · {entry.State} · {entry.Record.Digest}");
        }
        output.AppendLine()
            .AppendLine(
                $"Changed artifacts ({dashboard.Limits.ChangedArtifacts.Shown}/{dashboard.Limits.ChangedArtifacts.Total}):");
        foreach (var entry in dashboard.ChangedArtifacts)
        {
            output.AppendLine(
                $"  {entry.Locator.Value} · {entry.Locator.Kind} · Work Item {entry.SourceWorkItem.RecordId:D}");
        }
        output.AppendLine()
            .AppendLine($"Effect targets ({dashboard.Limits.EffectTargets.Shown}/{dashboard.Limits.EffectTargets.Total}):");
        foreach (var entry in dashboard.EffectTargets)
        {
            output.AppendLine(
                $"  {entry.Locator.Value} · {entry.Locator.Kind} · Work Item {entry.SourceWorkItem.RecordId:D}");
        }
        output.AppendLine()
            .AppendLine($"Affected units ({dashboard.Limits.AffectedUnits.Shown}/{dashboard.Limits.AffectedUnits.Total}):");
        foreach (var entry in dashboard.AffectedUnits)
        {
            output.AppendLine(
                $"  {entry.Direction} · {entry.Endpoint.RecordType}:{entry.Endpoint.RecordId} · " +
                $"{entry.Relationship} · {entry.Trace.AssessedState}");
        }
        output.AppendLine()
            .AppendLine($"Related Decisions ({dashboard.Limits.Decisions.Shown}/{dashboard.Limits.Decisions.Total}):");
        foreach (var entry in dashboard.Decisions)
        {
            output.AppendLine(
                $"  {entry.Record.RecordId:D}@{entry.Record.Revision} · {entry.State} · {entry.Outcome}");
        }
        output.AppendLine()
            .AppendLine($"Related Risks ({dashboard.Limits.Risks.Shown}/{dashboard.Limits.Risks.Total}):");
        foreach (var entry in dashboard.Risks)
        {
            output.AppendLine(
                $"  {entry.Record.RecordId:D}@{entry.Record.Revision} · {entry.State} · " +
                $"{entry.Likelihood}/{entry.Impact} · {entry.Acceptance}");
        }
        output.AppendLine()
            .AppendLine(
                $"Trace attention: unresolved={dashboard.Freshness.UnresolvedTraceLinks}; " +
                $"invalid={dashboard.Freshness.InvalidTraceLinks}; stale={dashboard.Freshness.StaleTraceLinks}; " +
                $"stale governance={dashboard.Freshness.StaleGovernanceReferences}")
            .AppendLine(
                $"Omissions: {(dashboard.Limits.Truncated ? "one or more bounded categories are truncated" : "none in bounded categories")}")
            .AppendLine("Coverage: absence of a trace link does not prove absence of impact.");
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output.AppendLine()
            .AppendLine(
                "Boundary: this read-only projection grants no Change approval, risk acceptance, mutation, Run, Tool, " +
                "write, effect, phase-entry, readiness, release, or outcome authority.")
            .Append(
                "Product text, Change text, Work Item text, source bytes, absolute paths, provider output, prompts, " +
                "executable state, and credentials are withheld.")
            .ToString();
    }

    private static string RenderAgentModelDashboard(AgentModelDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Agent and Model dashboard")
            .AppendLine()
            .AppendLine($"Product revision: {dashboard.ProductRevision}")
            .AppendLine($"Product digest: {dashboard.ProductDigest}")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine(
                $"Freshness: {dashboard.Freshness.State}; selection capability " +
                dashboard.Freshness.SelectionCapabilityState)
            .AppendLine($"Source: {dashboard.SourceBoundary}")
            .AppendLine($"Evidence freshness: {dashboard.EvidenceCues.Freshness}")
            .AppendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
            .AppendLine(
                $"Capability observation range: {dashboard.Freshness.OldestCapabilityObservedAt:O} to " +
                $"{dashboard.Freshness.NewestCapabilityObservedAt:O}")
            .AppendLine("Provider usage: unavailable; current Managed Run records have no provider usage contract.")
            .AppendLine("Provider cost: unavailable; current Managed Run records have no provider cost contract.")
            .AppendLine();
        var selection = dashboard.Selection;
        if (selection.Status is "selected" or "migration-required")
        {
            output.AppendLine($"Selection: {selection.Status}; {selection.AdapterId}/{selection.AgentId}; {selection.ModelId}")
                .AppendLine($"Selection digest: {selection.SelectionDigest}")
                .AppendLine($"Selection capability: {selection.CapabilityState}; {selection.CapabilityDigest}");
            foreach (var (key, value) in selection.Settings)
            {
                output.AppendLine($"  setting {key}={RenderSettingValue(value)}");
            }
        }
        else
        {
            output.AppendLine($"Selection: {selection.Status}");
        }
        output.AppendLine()
            .AppendLine($"Observed capabilities ({dashboard.CapabilityLimit.Shown}/{dashboard.CapabilityLimit.Total}):");
        foreach (var capability in dashboard.Capabilities)
        {
            output.AppendLine(
                $"  {capability.AdapterId}/{capability.AgentId}; {capability.AgentLabel}; " +
                $"{capability.ExecutionInterface}/{capability.InterfaceMaturity}; models={capability.ModelCount}; " +
                $"selected={capability.Selected.ToString().ToLowerInvariant()}; {capability.CapabilityDigest}");
        }
        output.AppendLine().AppendLine($"Runs ({dashboard.RunLimit.Shown}/{dashboard.RunLimit.Total}):");
        foreach (var run in dashboard.Runs)
        {
            var managed = run.Managed.Status == "observed"
                ? $"{run.Managed.State}/attempt-{run.Managed.AttemptNumber}/{run.Managed.ResultStatus}"
                : run.Managed.Status;
            output.AppendLine(
                $"  {run.RecordId:D}@{run.Revision}; {run.State}; " +
                $"{run.AdapterId}/{run.AgentId}/{run.ModelId}; managed={managed}");
        }
        output.AppendLine()
            .AppendLine($"Agent/model handoffs ({dashboard.HandoffLimit.Shown}/{dashboard.HandoffLimit.Total}):");
        foreach (var handoff in dashboard.Handoffs)
        {
            output.AppendLine(
                $"  {handoff.RecordId:D}; Run {handoff.FromRunId:D} -> " +
                $"{handoff.ToAdapterId}/{handoff.ToAgentId}/{handoff.ToModelId}; {handoff.State}");
        }
        output.AppendLine()
            .AppendLine($"Managed Run observations: {dashboard.ManagedRunLimit.Shown}/{dashboard.ManagedRunLimit.Total}")
            .AppendLine(
                $"Omissions: {(dashboard.Truncated ? "one or more bounded categories are truncated" : "none in reported categories")}")
            .AppendLine("Coverage: bounded current records do not prove provider-account or native-host readiness.");
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output.AppendLine()
            .AppendLine(
                "Boundary: this read-only projection cannot select or switch an agent, create a handoff, launch a Run, " +
                "authorize a Tool/write/effect, approve an outcome, establish readiness, or grant release authority.")
            .Append(
                "Product text, Run narrative, source bytes, absolute paths, provider output, prompts, executable state, " +
                "credentials, and sensitive setting values are withheld.")
            .ToString();
    }

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

    private static string RenderManagedEvidenceDetail(ManagedEvidenceDetail detail)
    {
        var summary = detail.Summary;
        var output = new StringBuilder()
            .AppendLine("GAEP exact Managed Run evidence detail")
            .AppendLine()
            .AppendLine($"Managed Run: {summary.ManagedRunId:D}")
            .AppendLine($"Governed Run: {summary.RunId:D}")
            .AppendLine($"Product / Initiative: {summary.ProductId:D} / {summary.InitiativeId:D}")
            .AppendLine($"State / mode: {summary.State} / {summary.Mode}")
            .AppendLine($"Provider: {summary.AdapterId} / {summary.AgentId} / {summary.ModelId}")
            .AppendLine(
                $"Recovery: {summary.RecoveryStatus}; attempt {summary.AttemptNumber}; " +
                $"checkpoints {summary.WorkflowCheckpointCount}")
            .AppendLine($"Artifact status: {detail.ArtifactStatus}")
            .AppendLine($"Bindings digest: {summary.BindingsDigest}");
        if (detail.Result is { } result)
        {
            output.AppendLine()
                .AppendLine("Verified result:")
                .AppendLine($"  Result: {result.ResultId:D} ({result.ResultDigest})")
                .AppendLine($"  Terminal state: {result.TerminalState}")
                .AppendLine(
                    $"  Provider disposition: {result.ProviderDisposition}; termination cause: {result.TerminationCause}")
                .AppendLine($"  Governed outcome: {result.OutcomeStatus} ({result.OutcomeBasis})")
                .AppendLine($"  Warnings: {(result.WarningCodes.Count == 0 ? "none" : string.Join(", ", result.WarningCodes))}")
                .AppendLine(
                    $"  Started / ended: {result.StartedAt.ToString("O", CultureInfo.InvariantCulture)} / " +
                    result.EndedAt.ToString("O", CultureInfo.InvariantCulture));
        }
        else
        {
            output.AppendLine("No committed result/evidence pair is bound to this record. No terminal outcome is inferred.");
        }
        if (detail.Evidence is { } evidence)
        {
            output.AppendLine()
                .AppendLine("Verified evidence:")
                .AppendLine($"  Evidence: {evidence.EvidenceId:D} ({evidence.EvidenceDigest})")
                .AppendLine(
                    $"  Events: {evidence.EventCount}; lifecycle={evidence.EventTypeCounts["lifecycle"]}; " +
                    $"output={evidence.EventTypeCounts["output"]}; item={evidence.EventTypeCounts["item"]}; " +
                    $"approval={evidence.EventTypeCounts["approval"]}; warning={evidence.EventTypeCounts["warning"]}; " +
                    $"error={evidence.EventTypeCounts["error"]}")
                .AppendLine(
                    $"  Workflow: {evidence.WorkflowStrategy}; {evidence.CompletedStepCount}/{evidence.WorkflowStepCount} " +
                    $"steps; {evidence.WorkflowAttemptCount} attempts")
                .AppendLine(
                    $"  Charter gates: evidence={evidence.CharterEvidenceStatus}; stop={evidence.CharterStopStatus}; " +
                    $"reason={evidence.TerminalReasonCode}")
                .AppendLine(
                    $"  Actual effects: not-observed={evidence.ActualEffectCounts["not-observed"]}; " +
                    $"provisional={evidence.ActualEffectCounts["observed-provisional"]}; " +
                    $"applied={evidence.ActualEffectCounts["applied"]}; blocked={evidence.ActualEffectCounts["blocked"]}; " +
                    $"unknown={evidence.ActualEffectCounts["unknown"]}");
            if (evidence.Staging is { } staging)
            {
                output.AppendLine(
                        $"  Staging: {staging.ApplyState}; changes={staging.ChangeCount}; excluded={staging.ExcludedPathCount}")
                    .AppendLine(
                        $"  Stage digests: baseline={staging.BaselineDigest}; final={staging.FinalDigest}; " +
                        $"inventory={staging.ChangedInventoryDigest}");
            }
            else
            {
                output.AppendLine("  Staging: not present");
            }
            output.AppendLine($"  Captured: {evidence.CapturedAt.ToString("O", CultureInfo.InvariantCulture)}");
        }
        if (detail.ApplyDecision is { } decision)
        {
            output.AppendLine()
                .AppendLine("Verified apply-decision evidence (observation only):")
                .AppendLine($"  Receipt: {decision.ReceiptId:D} ({decision.ReceiptDigest})")
                .AppendLine(
                    $"  Bound revision: {decision.ManagedRunRevision}; " +
                    $"changed inventory count={decision.ChangedInventoryCount}; " +
                    $"write-envelope count={decision.WriteEnvelopeCount}")
                .AppendLine($"  Decided: {decision.DecidedAt.ToString("O", CultureInfo.InvariantCulture)}");
        }
        return output.AppendLine()
            .AppendLine(
                "Boundary: provider completion is separate from governed outcome. Apply-decision evidence records a past exact " +
                "decision and grants this view no apply, discard, approval, Tool, write, effect, implementation-readiness, " +
                "release, or future Run authority.")
            .Append(
                "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, " +
                "workspace paths, and credentials are withheld.")
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

    private static bool SameInitiativeEntryBinding(InitiativeEntryContext left, InitiativeEntryContext right)
    {
        var leftAssessment = left.Assessment;
        var rightAssessment = right.Assessment;
        return left.Initiative == right.Initiative &&
            leftAssessment.InitiativeId == rightAssessment.InitiativeId &&
            leftAssessment.InitiativeRevision == rightAssessment.InitiativeRevision &&
            leftAssessment.ProductId == rightAssessment.ProductId &&
            leftAssessment.ProductRevision == rightAssessment.ProductRevision &&
            leftAssessment.ProductDigest == rightAssessment.ProductDigest &&
            leftAssessment.Classification == rightAssessment.Classification &&
            leftAssessment.Applicability == rightAssessment.Applicability &&
            leftAssessment.State == rightAssessment.State &&
            leftAssessment.Reasons.SequenceEqual(rightAssessment.Reasons, StringComparer.Ordinal);
    }

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
