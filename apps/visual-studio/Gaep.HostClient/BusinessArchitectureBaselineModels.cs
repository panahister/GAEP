namespace Gaep.HostClient;

public sealed record BusinessArchitectureBaselineRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int CoveredElementCount,
    int IntegrationClaimCount,
    int ConsistencyGapCount);

public sealed record BusinessArchitectureBaselineProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int CoveredElementCount,
    int IncludedElementCount,
    int ExcludedElementCount,
    int UnresolvedElementCount,
    int IntegrationClaimCount,
    int ConsistencyCheckCount,
    int ConsistencyGapCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    BusinessArchitectureBaselineRecordView? Baseline,
    string SnapshotDigest);
