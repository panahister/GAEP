namespace Gaep.HostClient;

public sealed record Phase2IntegratedSynchronization(
    string State,
    string DesignDelta,
    string ConflictResolution,
    string HumanDesignApproval,
    string DesignBaseline,
    string DesignDriftDetection,
    string FigmaConnectionState,
    string FigmaWriteExecutionState,
    string FigmaImportExecutionState,
    string SynchronizationEffectState);

public sealed record Phase2IntegratedImpact(
    string State,
    long RequirementCount,
    long DesignBindingCount,
    long UnboundDesignItemCount,
    long DriftObservationCount,
    long DriftCount,
    long UnassessedCount,
    long BlockerCount,
    long HighSeverityCount,
    long RemediationCandidateCount,
    long StaleBindingCount,
    long StaleSourceReferenceCount,
    long UnresolvedQuestionCount);

public sealed record Phase2IntegratedCapabilityTruth(
    long Shown,
    long Total,
    long Omitted,
    long Detected,
    long Unavailable,
    long Selected);

public sealed record Phase2IntegratedRunTruth(
    long Shown,
    long Total,
    long Omitted,
    long Terminal,
    long NonTerminal,
    long ManagedObserved,
    long ResultBound,
    long ActualEffectCount);

public sealed record Phase2IntegratedLimit(long Shown, long Total, long Omitted);

public sealed record Phase2IntegratedHandoffTruth(
    long Shown,
    long Total,
    long Omitted,
    long PendingAcknowledgement,
    long Acknowledged);

public sealed record Phase2ChangeImpactAgentModelDashboard(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string Phase2UxFigmaSnapshotDigest,
    string Phase2SourceCatalogDigest,
    string AgentModelSnapshotDigest,
    Phase2IntegratedSynchronization Synchronization,
    Phase2IntegratedImpact Impact,
    string SelectionState,
    Phase2IntegratedCapabilityTruth Capabilities,
    Phase2IntegratedRunTruth Runs,
    Phase2IntegratedLimit ManagedRuns,
    Phase2IntegratedHandoffTruth Handoffs,
    string FreshnessState,
    string Phase2State,
    string AgentModelState,
    string SelectionCapabilityState,
    string ProductOwnerAcceptance,
    string RunLaunchAuthority,
    string EffectAuthority,
    DateTimeOffset ObservedAt,
    IReadOnlyList<string> Limitations,
    string SnapshotDigest);
