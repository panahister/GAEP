using System.Collections.ObjectModel;
using System.Text;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

public enum AccessibleTableSortDirection
{
    Ascending,
    Descending,
}

public sealed record AccessibleTableColumn(string Key, string Label);

public sealed record AccessibleTableRow(string Id, IReadOnlyDictionary<string, string> Cells);

public sealed record AccessibleMetadataTable(
    string Id,
    string Title,
    IReadOnlyList<AccessibleTableColumn> Columns,
    IReadOnlyList<AccessibleTableRow> Rows,
    long Total,
    long Omitted,
    string SnapshotDigest,
    string SourceBoundary,
    string AuthorityBoundary);

public sealed record AccessibleTableView(
    AccessibleMetadataTable Table,
    IReadOnlyList<AccessibleTableRow> Rows,
    string Filter,
    string? SortKey,
    AccessibleTableSortDirection? SortDirection);

public static partial class AccessibleDashboardTables
{
    private const int MaximumFilterLength = 256;

    [GeneratedRegex("^[a-z][a-z0-9-]{0,63}$", RegexOptions.CultureInvariant)]
    private static partial Regex PortableKeyPattern();

    [GeneratedRegex("^sha256:[0-9a-f]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex DigestPattern();

    [GeneratedRegex("^\\s*[=+\\-@]", RegexOptions.CultureInvariant)]
    private static partial Regex FormulaPrefixPattern();

    public static AccessibleMetadataTable Exact(AccessibleMetadataTable table)
    {
        ArgumentNullException.ThrowIfNull(table);
        if (!PortableKeyPattern().IsMatch(table.Id))
        {
            throw new ArgumentException("Accessible table IDs must be portable kebab-case values.", nameof(table));
        }
        if (string.IsNullOrWhiteSpace(table.Title) || table.Title.Length > 160)
        {
            throw new ArgumentException("Accessible table titles must contain 1 to 160 characters.", nameof(table));
        }
        if (table.Columns.Count is < 1 or > 64)
        {
            throw new ArgumentOutOfRangeException(nameof(table), "Accessible tables require 1 to 64 visible columns.");
        }
        if (table.Rows.Count > 1_000)
        {
            throw new ArgumentOutOfRangeException(nameof(table), "Accessible tables expose at most 1,000 already-bounded rows.");
        }
        if (table.Total < table.Rows.Count || table.Omitted != table.Total - table.Rows.Count)
        {
            throw new ArgumentOutOfRangeException(
                nameof(table),
                "Accessible table totals must exactly reconcile with visible and omitted rows.");
        }
        if (!DigestPattern().IsMatch(table.SnapshotDigest))
        {
            throw new ArgumentException("Accessible tables require one exact snapshot digest.", nameof(table));
        }
        if (string.IsNullOrWhiteSpace(table.SourceBoundary) || string.IsNullOrWhiteSpace(table.AuthorityBoundary))
        {
            throw new ArgumentException("Accessible tables require explicit source and authority boundaries.", nameof(table));
        }
        var keys = table.Columns.Select(column => column.Key).ToArray();
        if (keys.Distinct(StringComparer.Ordinal).Count() != keys.Length || table.Columns.Any(column =>
                !PortableKeyPattern().IsMatch(column.Key) || string.IsNullOrWhiteSpace(column.Label) || column.Label.Length > 160))
        {
            throw new ArgumentException("Accessible table columns must be unique bounded portable values.", nameof(table));
        }
        if (table.Rows.Select(row => row.Id).Distinct(StringComparer.Ordinal).Count() != table.Rows.Count)
        {
            throw new ArgumentException("Accessible table row IDs must be unique.", nameof(table));
        }
        var keySet = keys.ToHashSet(StringComparer.Ordinal);
        foreach (var row in table.Rows)
        {
            if (string.IsNullOrEmpty(row.Id) || row.Id.Length > 256 ||
                row.Cells.Count != keySet.Count || row.Cells.Keys.Any(key => !keySet.Contains(key)) ||
                row.Cells.Values.Any(value => value is null || value.Length > 4_000))
            {
                throw new ArgumentException(
                    "Accessible table rows must have unique bounded IDs and exactly the visible bounded string cells.",
                    nameof(table));
            }
        }
        return table with
        {
            Columns = Array.AsReadOnly(table.Columns.Select(column => column with { }).ToArray()),
            Rows = Array.AsReadOnly(table.Rows.Select(row => row with
            {
                Cells = new ReadOnlyDictionary<string, string>(
                    new Dictionary<string, string>(row.Cells, StringComparer.Ordinal)),
            }).ToArray()),
        };
    }

    public static AccessibleTableView View(
        AccessibleMetadataTable table,
        string filter = "",
        string? sortKey = null,
        AccessibleTableSortDirection? sortDirection = null)
    {
        var exact = Exact(table);
        filter ??= string.Empty;
        if (filter.Length > MaximumFilterLength)
        {
            throw new ArgumentOutOfRangeException(nameof(filter), "Accessible table filters contain at most 256 characters.");
        }
        if ((sortKey is null) != (sortDirection is null))
        {
            throw new ArgumentException("Accessible table sort column and direction must be supplied together.");
        }
        if (sortKey is not null && !exact.Columns.Any(column => column.Key == sortKey))
        {
            throw new ArgumentException("Accessible table sort column must be one of the visible columns.", nameof(sortKey));
        }
        var normalizedFilter = filter.Trim().ToLowerInvariant();
        IEnumerable<AccessibleTableRow> rows = exact.Rows.Where(row => normalizedFilter.Length == 0 ||
            exact.Columns.Any(column => row.Cells[column.Key].Contains(normalizedFilter, StringComparison.OrdinalIgnoreCase)));
        if (sortKey is not null && sortDirection is not null)
        {
            rows = rows.OrderBy(row => row, Comparer<AccessibleTableRow>.Create((left, right) =>
            {
                var comparison = StringComparer.Ordinal.Compare(left.Cells[sortKey], right.Cells[sortKey]);
                var deterministic = comparison == 0 ? StringComparer.Ordinal.Compare(left.Id, right.Id) : comparison;
                return sortDirection == AccessibleTableSortDirection.Ascending ? deterministic : -deterministic;
            }));
        }
        return new AccessibleTableView(exact, Array.AsReadOnly(rows.ToArray()), filter, sortKey, sortDirection);
    }

    public static string Render(AccessibleTableView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        var sort = view.SortKey is null
            ? "source order"
            : $"{view.Table.Columns.Single(column => column.Key == view.SortKey).Label}, " +
              view.SortDirection!.Value.ToString().ToLowerInvariant();
        var output = new StringBuilder()
            .AppendLine($"GAEP accessible metadata table: {view.Table.Title}")
            .AppendLine()
            .AppendLine(
                $"Showing {view.Rows.Count} of {view.Table.Rows.Count} verified rows; {view.Table.Omitted} omitted upstream; " +
                $"source total {view.Table.Total}.")
            .AppendLine($"Sort: {sort}")
            .AppendLine($"Filter: {(string.IsNullOrWhiteSpace(view.Filter) ? "none" : view.Filter.Trim())}")
            .AppendLine($"Snapshot digest: {view.Table.SnapshotDigest}")
            .AppendLine($"Source boundary: {view.Table.SourceBoundary}")
            .AppendLine();
        if (view.Rows.Count == 0) output.AppendLine("No verified rows match the current filter.");
        for (var index = 0; index < view.Rows.Count; index++)
        {
            var row = view.Rows[index];
            output.AppendLine(
                $"{index + 1}. " + string.Join(" · ", view.Table.Columns.Select(column =>
                    $"{column.Label}: {row.Cells[column.Key]}")));
        }
        return output.AppendLine().Append($"Boundary: {view.Table.AuthorityBoundary}").ToString();
    }

    public static string Csv(AccessibleTableView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        static string Cell(string value)
        {
            var neutralized = FormulaPrefixPattern().IsMatch(value) || value.Length > 0 && value[0] is '\t' or '\r' or '\n'
                ? $"'{value}"
                : value;
            return $"\"{neutralized.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
        }
        return string.Join("\r\n", new[]
        {
            string.Join(",", view.Table.Columns.Select(column => Cell(column.Label))),
        }.Concat(view.Rows.Select(row =>
            string.Join(",", view.Table.Columns.Select(column => Cell(row.Cells[column.Key]))))));
    }

    public static IReadOnlyList<AccessibleMetadataTable> Phase(PhaseDashboardFramework dashboard) =>
        Array.AsReadOnly(new[]
        {
            Table(
                "phase-panels",
                $"{dashboard.PhaseLabel} panels",
                Columns(
                    ("panel-id", "Panel ID"), ("title", "Title"), ("role", "Role"),
                    ("applicability", "Applicability"), ("basis", "Applicability basis"), ("state", "State"),
                    ("decision", "Decision binding")),
                dashboard.Panels.Select(panel => Row(
                    panel.Id,
                    ("panel-id", panel.Id),
                    ("title", panel.Title),
                    ("role", panel.Role),
                    ("applicability", panel.Applicability.Status),
                    ("basis", panel.Applicability.Basis),
                    ("state", panel.State),
                    ("decision", panel.Applicability.Decision is { } decision
                        ? $"{decision.RecordId:D}@{decision.Revision} · {decision.Digest}"
                        : "not bound"))).ToArray(),
                dashboard.Panels.Count,
                0,
                dashboard.CompositionDigest,
                "governed-repository-and-engine-only",
                "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence"),
        });

    public static IReadOnlyList<AccessibleMetadataTable> Phase2UxFigma(Phase2UxFigmaDashboard dashboard)
    {
        const string source = "current-governed-product-initiative-and-phase-2-projections-only";
        const string authority =
            "phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority";
        return Array.AsReadOnly(new[]
        {
            Table(
                "phase2-summary",
                "Phase 2 UX and Figma summary",
                Columns(("area", "Area"), ("inventory", "Inventory"), ("boundary", "Authority boundary")),
                new[]
                {
                    Row(
                        "experience", ("area", "Experience"),
                        ("inventory", $"{dashboard.PersonaCount} personas · {dashboard.DesignRoleCount} roles · " +
                            $"{dashboard.JourneyCount} journeys · {dashboard.ScreenCount} screens · {dashboard.StateCount} states"),
                        ("boundary", "Counts do not establish completeness or validity.")),
                    Row(
                        "figma", ("area", "Figma and trace"),
                        ("inventory", $"{dashboard.FigmaFileCount} files · {dashboard.DesignBindingCount} bindings"),
                        ("boundary", $"Connection {dashboard.FigmaConnectionState}; write {dashboard.FigmaWriteExecutionState}; " +
                            $"import {dashboard.FigmaImportExecutionState}.")),
                    Row(
                        "governance", ("area", "Governance"),
                        ("inventory", $"{dashboard.CurrentSourceCount} current · {dashboard.AttentionRequiredSourceCount} attention · " +
                            $"{dashboard.UnavailableSourceCount} unavailable"),
                        ("boundary", "Approval, Baseline Set, readiness, phase entry, and remediation effects are not established.")),
                },
                3,
                0,
                dashboard.SnapshotDigest,
                source,
                authority),
            Table(
                "phase2-sources",
                "Phase 2 governed source projections",
                Columns(
                    ("source", "Source"), ("group", "Group"), ("projection-kind", "Projection kind"),
                    ("availability", "Availability"), ("assessment", "Assessment")),
                dashboard.Sources.Select(value => Row(
                    value.Id, ("source", value.Title), ("group", value.Group), ("projection-kind", value.ProjectionKind),
                    ("availability", value.Availability), ("assessment", value.AssessmentState ?? "no state inferred"))).ToArray(),
                dashboard.Sources.Count,
                0,
                dashboard.SnapshotDigest,
                source,
                authority),
        });
    }

    public static IReadOnlyList<AccessibleMetadataTable> Phase2ChangeImpactAgentModel(
        Phase2ChangeImpactAgentModelDashboard dashboard)
    {
        const string source = "exact-derived-phase-2-dashboard-and-current-initiative-scoped-agent-model-metadata-only";
        const string authority =
            "phase-2-change-impact-agent-model-dashboard-is-derived-read-only-evidence-not-a-second-source-of-truth-impact-completeness-design-validity-provider-quality-selection-run-launch-approval-baseline-readiness-remediation-effect-release-or-action-authority";
        return Array.AsReadOnly(new[]
        {
            Table(
                "phase2-synchronization-change",
                "Phase 2 synchronization change evidence",
                Columns(("source", "Governed source"), ("state", "Availability"), ("effect", "Effect boundary")),
                new[]
                {
                    Row("design-delta", ("source", "Design delta"), ("state", dashboard.Synchronization.DesignDelta), ("effect", "Not applied")),
                    Row("conflicts", ("source", "Conflict resolution"), ("state", dashboard.Synchronization.ConflictResolution), ("effect", "Not applied")),
                    Row("approval", ("source", "Human design approval"), ("state", dashboard.Synchronization.HumanDesignApproval), ("effect", "Not applied")),
                    Row("baseline", ("source", "Design baseline"), ("state", dashboard.Synchronization.DesignBaseline), ("effect", "Not applied")),
                    Row("drift", ("source", "Design drift detection"), ("state", dashboard.Synchronization.DesignDriftDetection), ("effect", "Not applied")),
                },
                5, 0, dashboard.SnapshotDigest, source, authority),
            Table(
                "phase2-bounded-impact",
                "Phase 2 bounded impact signals",
                Columns(("area", "Area"), ("counts", "Observed counts"), ("boundary", "Coverage boundary")),
                new[]
                {
                    Row(
                        "trace", ("area", "Design and trace"),
                        ("counts", $"{dashboard.Impact.RequirementCount} requirements · {dashboard.Impact.DesignBindingCount} bindings · {dashboard.Impact.UnboundDesignItemCount} unbound items"),
                        ("boundary", "Impact completeness and design validity are not established.")),
                    Row(
                        "drift", ("area", "Drift"),
                        ("counts", $"{dashboard.Impact.DriftObservationCount} observations · {dashboard.Impact.DriftCount} drift · {dashboard.Impact.UnassessedCount} unassessed"),
                        ("boundary", "No remediation or revalidation effect is applied.")),
                },
                2, 0, dashboard.SnapshotDigest, source, authority),
            Table(
                "phase2-agent-model-execution",
                "Initiative-scoped agent and model execution truth",
                Columns(("area", "Area"), ("counts", "Bounded counts"), ("authority", "Authority boundary")),
                new[]
                {
                    Row(
                        "capabilities", ("area", "Capabilities and selection"),
                        ("counts", $"{dashboard.Capabilities.Shown}/{dashboard.Capabilities.Total} shown · {dashboard.Capabilities.Detected} detected · {dashboard.Capabilities.Selected} selected"),
                        ("authority", "No automatic selection or provider preference authority.")),
                    Row(
                        "runs", ("area", "Runs and Managed Runs"),
                        ("counts", $"{dashboard.Runs.Shown}/{dashboard.Runs.Total} shown · {dashboard.Runs.Terminal} terminal · {dashboard.Runs.ResultBound} results bound"),
                        ("authority", "No Run launch or effect authority.")),
                    Row(
                        "handoffs", ("area", "Handoffs"),
                        ("counts", $"{dashboard.Handoffs.Shown}/{dashboard.Handoffs.Total} shown · {dashboard.Handoffs.Acknowledged} acknowledged"),
                        ("authority", "No handoff acknowledgement or action authority.")),
                },
                3, 0, dashboard.SnapshotDigest, source, authority),
        });
    }

    public static IReadOnlyList<AccessibleMetadataTable> ChangeImpact(ChangeImpactDashboard dashboard)
    {
        const string source = "current-governed-records-and-bounded-trace-analysis";
        const string authority = "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects";
        AccessibleMetadataTable Bounded(
            string id,
            string title,
            IReadOnlyList<AccessibleTableColumn> columns,
            IReadOnlyList<AccessibleTableRow> rows,
            ChangeImpactLimit limit) =>
            Table(id, title, columns, rows, limit.Total, limit.Omitted, dashboard.SnapshotDigest, source, authority);
        return Array.AsReadOnly(new[]
        {
            Bounded(
                "change-work-items",
                "Change Work Items",
                Columns(("record-id", "Record ID"), ("revision", "Revision"), ("state", "State"), ("digest", "Digest")),
                dashboard.WorkItems.Select(entry => Row(
                    entry.Record.RecordId.ToString("D"),
                    ("record-id", entry.Record.RecordId.ToString("D")),
                    ("revision", entry.Record.Revision.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                    ("state", entry.State),
                    ("digest", entry.Record.Digest))).ToArray(),
                dashboard.Limits.WorkItems),
            Bounded(
                "changed-artifacts",
                "Changed artifacts",
                Columns(("locator", "Locator"), ("kind", "Kind"), ("work-item", "Source Work Item")),
                dashboard.ChangedArtifacts.Select((entry, index) => Row(
                    $"{entry.SourceWorkItem.RecordId:D}:artifact:{index}",
                    ("locator", entry.Locator.Value),
                    ("kind", entry.Locator.Kind),
                    ("work-item", entry.SourceWorkItem.RecordId.ToString("D")))).ToArray(),
                dashboard.Limits.ChangedArtifacts),
            Bounded(
                "effect-targets",
                "Effect targets",
                Columns(("locator", "Locator"), ("kind", "Kind"), ("work-item", "Source Work Item")),
                dashboard.EffectTargets.Select((entry, index) => Row(
                    $"{entry.SourceWorkItem.RecordId:D}:effect:{index}",
                    ("locator", entry.Locator.Value),
                    ("kind", entry.Locator.Kind),
                    ("work-item", entry.SourceWorkItem.RecordId.ToString("D")))).ToArray(),
                dashboard.Limits.EffectTargets),
            Bounded(
                "affected-units",
                "Affected units",
                Columns(
                    ("direction", "Direction"), ("endpoint", "Endpoint"), ("relationship", "Relationship"),
                    ("trace-state", "Trace state"), ("trace-id", "Trace ID"),
                    ("assessment-digest", "Assessment digest")),
                dashboard.AffectedUnits.Select(entry => Row(
                    $"{entry.Trace.RecordId:D}:{entry.Direction}:{entry.Endpoint.RecordId}",
                    ("direction", entry.Direction),
                    ("endpoint", $"{entry.Endpoint.RecordType}:{entry.Endpoint.RecordId}"),
                    ("relationship", entry.Relationship),
                    ("trace-state", entry.Trace.AssessedState),
                    ("trace-id", entry.Trace.RecordId.ToString("D")),
                    ("assessment-digest", entry.Trace.AssessmentDigest))).ToArray(),
                dashboard.Limits.AffectedUnits),
            Bounded(
                "related-decisions",
                "Related Decisions",
                Columns(
                    ("record-id", "Record ID"), ("revision", "Revision"), ("state", "State"),
                    ("outcome", "Outcome"), ("digest", "Digest")),
                dashboard.Decisions.Select(entry => Row(
                    entry.Record.RecordId.ToString("D"),
                    ("record-id", entry.Record.RecordId.ToString("D")),
                    ("revision", entry.Record.Revision.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                    ("state", entry.State),
                    ("outcome", entry.Outcome),
                    ("digest", entry.Record.Digest))).ToArray(),
                dashboard.Limits.Decisions),
            Bounded(
                "related-risks",
                "Related Risks",
                Columns(
                    ("record-id", "Record ID"), ("revision", "Revision"), ("state", "State"),
                    ("likelihood", "Likelihood"), ("impact", "Impact"), ("acceptance", "Acceptance"),
                    ("digest", "Digest")),
                dashboard.Risks.Select(entry => Row(
                    entry.Record.RecordId.ToString("D"),
                    ("record-id", entry.Record.RecordId.ToString("D")),
                    ("revision", entry.Record.Revision.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                    ("state", entry.State),
                    ("likelihood", entry.Likelihood),
                    ("impact", entry.Impact),
                    ("acceptance", entry.Acceptance),
                    ("digest", entry.Record.Digest))).ToArray(),
                dashboard.Limits.Risks),
        });
    }

    public static IReadOnlyList<AccessibleMetadataTable> AgentModel(AgentModelDashboard dashboard)
    {
        const string source = "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata";
        const string authority = "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects";
        AccessibleMetadataTable Bounded(
            string id,
            string title,
            IReadOnlyList<AccessibleTableColumn> columns,
            IReadOnlyList<AccessibleTableRow> rows,
            AgentModelLimit limit) =>
            Table(id, title, columns, rows, limit.Total, limit.Omitted, dashboard.SnapshotDigest, source, authority);
        var selection = dashboard.Selection;
        return Array.AsReadOnly(new[]
        {
            Bounded(
                "agent-capabilities",
                "Observed agent capabilities",
                Columns(
                    ("agent", "Agent"), ("adapter-version", "Adapter version"), ("runtime-version", "Runtime version"),
                    ("detected", "Detected"), ("interface", "Execution interface"), ("maturity", "Interface maturity"),
                    ("models", "Model count"), ("selected", "Selected"), ("observed-at", "Observed at"),
                    ("digest", "Capability digest")),
                dashboard.Capabilities.Select(capability => Row(
                    $"{capability.AdapterId}:{capability.AgentId}",
                    ("agent", $"{capability.AdapterId}/{capability.AgentId} · {capability.AgentLabel}"),
                    ("adapter-version", capability.AdapterVersion),
                    ("runtime-version", capability.RuntimeVersion ?? "not observed"),
                    ("detected", capability.Detected.ToString().ToLowerInvariant()),
                    ("interface", capability.ExecutionInterface),
                    ("maturity", capability.InterfaceMaturity),
                    ("models", capability.ModelCount.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                    ("selected", capability.Selected.ToString().ToLowerInvariant()),
                    ("observed-at", capability.ObservedAt.ToString("O")),
                    ("digest", capability.CapabilityDigest))).ToArray(),
                dashboard.CapabilityLimit),
            Table(
                "agent-selection",
                "Current Agent Selection",
                Columns(
                    ("status", "Status"), ("agent", "Agent"), ("model", "Model"),
                    ("truth-class", "Model truth class"), ("alias", "Model alias"),
                    ("capability-state", "Capability state"), ("selected-at", "Selected at"),
                    ("selection-digest", "Selection digest"), ("capability-digest", "Capability digest")),
                new[]
                {
                    Row(
                        "current-selection",
                        ("status", selection.Status),
                        ("agent", selection.AdapterId is null ? "not available" : $"{selection.AdapterId}/{selection.AgentId}"),
                        ("model", selection.ModelId ?? "not available"),
                        ("truth-class", selection.ModelTruthClass ?? "not available"),
                        ("alias", selection.ModelAlias?.ToString().ToLowerInvariant() ?? "not available"),
                        ("capability-state", selection.CapabilityState ?? "not available"),
                        ("selected-at", selection.SelectedAt?.ToString("O") ?? "not available"),
                        ("selection-digest", selection.SelectionDigest ?? "not available"),
                        ("capability-digest", selection.CapabilityDigest ?? "not available")),
                },
                1,
                0,
                dashboard.SnapshotDigest,
                source,
                authority),
            Bounded(
                "agent-runs",
                "Agent Runs and Managed evidence",
                Columns(
                    ("run-id", "Run ID"), ("revision", "Revision"), ("state", "State"), ("agent", "Agent"),
                    ("model", "Model"), ("managed-state", "Managed state"), ("managed-result", "Managed result")),
                dashboard.Runs.Select(run => Row(
                    run.RecordId.ToString("D"),
                    ("run-id", run.RecordId.ToString("D")),
                    ("revision", run.Revision.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                    ("state", run.State),
                    ("agent", $"{run.AdapterId}/{run.AgentId}"),
                    ("model", run.ModelId),
                    ("managed-state", run.Managed.Status == "observed"
                        ? $"{run.Managed.State} · attempt {run.Managed.AttemptNumber}"
                        : run.Managed.Status),
                    ("managed-result", run.Managed.ResultStatus ?? "not observed"))).ToArray(),
                dashboard.RunLimit),
            Bounded(
                "agent-handoffs",
                "Agent and model handoffs",
                Columns(
                    ("handoff-id", "Handoff ID"), ("from-run", "From Run"), ("target", "Target selection"),
                    ("state", "State"), ("created-at", "Created at")),
                dashboard.Handoffs.Select(handoff => Row(
                    handoff.RecordId.ToString("D"),
                    ("handoff-id", handoff.RecordId.ToString("D")),
                    ("from-run", handoff.FromRunId.ToString("D")),
                    ("target", $"{handoff.ToAdapterId}/{handoff.ToAgentId}/{handoff.ToModelId}"),
                    ("state", handoff.State),
                    ("created-at", handoff.CreatedAt.ToString("O")))).ToArray(),
                dashboard.HandoffLimit),
            Table(
                "provider-metrics",
                "Provider usage and cost metadata",
                Columns(("metric", "Metric"), ("state", "State"), ("basis", "Basis")),
                new[]
                {
                    Row(
                        "usage",
                        ("metric", "Usage"),
                        ("state", "unavailable"),
                        ("basis", "current-managed-records-have-no-provider-usage-or-cost-contract")),
                    Row(
                        "cost",
                        ("metric", "Cost"),
                        ("state", "unavailable"),
                        ("basis", "current-managed-records-have-no-provider-usage-or-cost-contract")),
                },
                2,
                0,
                dashboard.SnapshotDigest,
                source,
                authority),
        });
    }

    private static AccessibleMetadataTable Table(
        string id,
        string title,
        IReadOnlyList<AccessibleTableColumn> columns,
        IReadOnlyList<AccessibleTableRow> rows,
        long total,
        long omitted,
        string snapshotDigest,
        string sourceBoundary,
        string authorityBoundary) =>
        Exact(new AccessibleMetadataTable(
            id,
            title,
            columns,
            rows,
            total,
            omitted,
            snapshotDigest,
            sourceBoundary,
            authorityBoundary));

    private static IReadOnlyList<AccessibleTableColumn> Columns(
        params (string Key, string Label)[] values) =>
        Array.AsReadOnly(values.Select(value => new AccessibleTableColumn(value.Key, value.Label)).ToArray());

    private static AccessibleTableRow Row(string id, params (string Key, string Value)[] values) =>
        new(id, new ReadOnlyDictionary<string, string>(values.ToDictionary(
            value => value.Key,
            value => value.Value,
            StringComparer.Ordinal)));
}
