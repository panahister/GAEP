namespace Gaep.HostClient;

public sealed record ValueStreamModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    int ValueStreamCount,
    int OwnedValueStreamCount,
    int StageCount,
    int DependencyCount,
    int OpenBottleneckCount,
    int CriticalBottleneckCount);

public sealed record ValueStreamModelProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int ValueStreamCount,
    int OwnedValueStreamCount,
    int UnownedValueStreamCount,
    int StageCount,
    int DependencyCount,
    int CapabilityCoverageCount,
    int OutcomeCoverageCount,
    int AbsentFlowEvidenceCount,
    int OpenBottleneckCount,
    int CriticalBottleneckCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    ValueStreamModelRecordView? ValueStreamModel,
    string SnapshotDigest);
