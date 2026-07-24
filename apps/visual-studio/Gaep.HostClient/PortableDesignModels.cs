namespace Gaep.HostClient;

public enum PortableDesignClassification
{
    Public,
    Internal,
    Confidential,
    Restricted,
}

public enum PortableDesignSourceReviewStatus
{
    Unreviewed,
    Reviewed,
    Approved,
}

public enum PortableDesignExportMethod
{
    ManualExport,
    DesignToolExport,
    PluginExport,
}

public sealed record ProductBinding(
    Guid Id,
    string Name,
    long Revision);

public sealed record AgentModelReadiness(
    string Id,
    string Label,
    string TruthClass,
    bool Alias);

public abstract record PortableAgentSettingValue;

public sealed record PortableAgentText(string Value) : PortableAgentSettingValue;

public sealed record PortableAgentNumber(double Value) : PortableAgentSettingValue;

public sealed record PortableAgentBoolean(bool Value) : PortableAgentSettingValue;

public sealed record PortableAgentTextList(IReadOnlyList<string> Value) : PortableAgentSettingValue;

public sealed record AgentSettingOption(
    string Value,
    string Label,
    string? Description);

public sealed record AgentSelectionSetting(
    string Key,
    string Label,
    string Description,
    string Kind,
    bool Required,
    bool Sensitive,
    PortableAgentSettingValue? DefaultValue,
    IReadOnlyList<AgentSettingOption>? Options,
    double? Minimum,
    double? Maximum,
    string TruthClass);

public sealed record AgentSelection(
    int SchemaVersion,
    string AdapterId,
    string AgentId,
    string ModelId,
    string ModelTruthClass,
    bool? ModelAlias,
    IReadOnlyDictionary<string, PortableAgentSettingValue> Settings,
    DateTimeOffset SelectedAt,
    string CapabilityDigest);

public enum AgentSelectionStatus
{
    Unselected,
    Selected,
    MigrationRequired,
    Invalid,
}

public sealed record AgentSelectionState(
    AgentSelectionStatus Status,
    AgentSelection? Selection,
    AgentSelection? PortableCandidate);

public enum AgentRunState
{
    Prepared,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
    Unknown,
}

public sealed record AgentRun(
    int SchemaVersion,
    Guid Id,
    long? Revision,
    Guid CharterId,
    string? CharterDigest,
    Guid ProductId,
    Guid InitiativeId,
    AgentSelection Agent,
    AgentRunState State,
    string? ProviderSessionRef,
    DateTimeOffset? StartedAt,
    DateTimeOffset? EndedAt,
    Guid? PreviousRunId);

public sealed record HandoffWorkspaceBaseline(
    string? GitHead,
    bool? Dirty,
    IReadOnlyList<string> ChangedFiles,
    string? TruthClass,
    string? ObservationError);

public sealed record AgentHandoff(
    int SchemaVersion,
    Guid Id,
    Guid ProductId,
    Guid InitiativeId,
    Guid FromRunId,
    AgentSelection ToAgent,
    string Reason,
    HandoffWorkspaceBaseline WorkspaceBaseline,
    IReadOnlyList<string> CompletedWork,
    IReadOnlyList<string> UnresolvedMatters,
    IReadOnlyList<string> Decisions,
    IReadOnlyList<string> Evidence,
    IReadOnlyList<string> CapabilityDifferences,
    DateTimeOffset CreatedAt,
    DateTimeOffset? AcknowledgedAt);

public sealed record ManagedReadOnlyGatePreview(
    string Key,
    Guid? StepId,
    string Phase,
    IReadOnlyList<string> Criteria,
    string CriteriaDigest);

public sealed record ManagedReadOnlyPreview(
    int SchemaVersion,
    string Kind,
    Guid ProductId,
    Guid InitiativeId,
    Guid CharterId,
    string CharterDigest,
    Guid WorkflowPlanId,
    string WorkflowPlanDigest,
    string AdapterId,
    string AgentId,
    string ModelId,
    string SelectionDigest,
    string Strategy,
    IReadOnlyList<Guid> StepIds,
    int ContextPackCount,
    int ReadScopeCount,
    IReadOnlyList<ManagedReadOnlyGatePreview> Gates,
    string AuthorityBoundary,
    string PreviewDigest);

public sealed record ManagedReadOnlyReceipt(
    int SchemaVersion,
    string Kind,
    string PreviewDigest,
    Guid RunId,
    Guid ManagedRunId,
    Guid ProductId,
    Guid InitiativeId,
    string AdapterId,
    string AgentId,
    string ModelId,
    string Mode,
    string State,
    string ProviderDisposition,
    string OutcomeStatus,
    string OutcomeBasis,
    int EventCount,
    int CompletedStepCount,
    int TotalStepCount,
    string ResultDigest,
    string EvidenceDigest,
    IReadOnlyList<string> Warnings,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    string AuthorityBoundary);

public sealed record AgentReadinessSnapshot(
    int SchemaVersion,
    string AdapterId,
    string AdapterVersion,
    string AgentId,
    string AgentLabel,
    string? RuntimeVersion,
    bool Detected,
    string ExecutionInterface,
    string InterfaceMaturity,
    bool SupportsResume,
    bool SupportsCancel,
    bool SupportsCheckpoints,
    bool SupportsModelDiscovery,
    bool SupportsToolSelection,
    int SettingsCount,
    IReadOnlyList<AgentSelectionSetting> Settings,
    IReadOnlyList<AgentModelReadiness> Models,
    IReadOnlyList<string> Limitations,
    DateTimeOffset ObservedAt);

public sealed record PortableDesignGovernanceMetadata(
    string State,
    bool HumanReviewRequired,
    string ClaimBoundary,
    string NonEscalation);

public sealed record PortableDesignSourceReviewMetadata(
    PortableDesignSourceReviewStatus Status,
    string ClaimLabel,
    bool GaepApproval);

public sealed record PortableDesignSourceMetadata(
    string Tool,
    PortableDesignExportMethod ExportMethod);

public sealed record PortableDesignCounts(
    int Artifacts,
    int NormalizedDesignTokens,
    int ValidationChecks,
    int RecordedLimitations);

public sealed record PortableDesignDigests(
    string Snapshot,
    string Evidence,
    string Manifest,
    string ArtifactInventory);

public sealed record PortableDesignTimestamps(
    DateTimeOffset SourceExportedAt,
    DateTimeOffset ImportedAt);

public sealed record PortableDesignSnapshotSummary(
    int SchemaVersion,
    string Kind,
    Guid BundleId,
    Guid ProductId,
    Guid? InitiativeId,
    string Title,
    PortableDesignClassification Classification,
    PortableDesignGovernanceMetadata Governance,
    PortableDesignSourceReviewMetadata SourceReview,
    PortableDesignSourceMetadata Source,
    PortableDesignCounts Counts,
    PortableDesignDigests Digests,
    PortableDesignTimestamps Timestamps,
    string PrivacyBoundary);

public sealed record PortableDesignSnapshotPage(
    IReadOnlyList<PortableDesignSnapshotSummary> Items,
    int Offset,
    int Limit,
    int Total,
    bool HasMore,
    string GovernanceBoundary,
    string PrivacyBoundary);

public sealed class EngineHostException : Exception
{
    internal EngineHostException(int code, string kind, string message)
        : base(message)
    {
        Code = code;
        Kind = kind;
    }

    public int Code { get; }

    public string Kind { get; }
}
