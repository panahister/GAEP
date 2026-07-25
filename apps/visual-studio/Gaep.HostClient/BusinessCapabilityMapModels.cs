namespace Gaep.HostClient;

public sealed record BusinessCapabilityMapRecordView(
    Guid Id,
    long Revision,
    string Digest,
    int CapabilityCount,
    int OwnedCapabilityCount,
    int OpenGapCount,
    int CriticalGapCount,
    int CandidatePriorityCount);

public sealed record BusinessCapabilityMapProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int CapabilityCount,
    int OwnedCapabilityCount,
    int UnownedCapabilityCount,
    int ObjectiveCoverageCount,
    int OutcomeCoverageCount,
    int OpenGapCount,
    int CriticalGapCount,
    int UnknownCurrentMaturityCount,
    int UnassessedPriorityCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    BusinessCapabilityMapRecordView? CapabilityMap,
    string SnapshotDigest);
