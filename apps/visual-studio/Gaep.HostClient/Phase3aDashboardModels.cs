namespace Gaep.HostClient;

public sealed record Phase3aDashboardSource(
    string Id,
    string Title,
    string Group,
    string ProjectionKind,
    string Availability,
    string? AssessmentState,
    int GapCount,
    int ConflictCount,
    int StaleCount,
    int UnresolvedCount);

public sealed record Phase3aDashboardView(
    string Id,
    string Title,
    string State,
    int CurrentSourceCount,
    int AttentionRequiredSourceCount,
    int UnavailableSourceCount,
    int CandidateCount,
    int EvidenceReferenceCount,
    int GapCount,
    int ConflictCount,
    int StaleCount,
    int UnresolvedCount,
    int WorkflowEvidenceCount);

public sealed record Phase3aDashboardWorkflow(
    string Provider,
    string Availability,
    string ExecutionMode,
    string LiveAcceptance,
    string SemanticQuality,
    string Authority);

public sealed record Phase3aDashboard(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string PhaseState,
    int CurrentSourceCount,
    int AttentionRequiredSourceCount,
    int UnavailableSourceCount,
    int ProviderWorkflowEvidenceCount,
    string FreshnessState,
    int StaleCount,
    int UnresolvedCount,
    IReadOnlyList<Phase3aDashboardSource> Sources,
    IReadOnlyList<Phase3aDashboardView> Views,
    IReadOnlyList<Phase3aDashboardWorkflow> Workflows,
    IReadOnlyList<string> Limitations,
    DateTimeOffset ObservedAt,
    string SnapshotDigest);
