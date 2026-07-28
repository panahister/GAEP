namespace Gaep.HostClient;

public sealed record InformationArchitectureRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int NodeCount,
    int RootNodeCount,
    int RouteCount,
    string ReviewState);

public sealed record InformationArchitectureProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    string ReviewState,
    IReadOnlyList<string> Reasons,
    int NodeCount,
    int RootNodeCount,
    int RouteCount,
    int RepresentedScopeCount,
    int UnresolvedScopeCount,
    int WeakEvidenceNodeCount,
    int WeakEvidenceRouteCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    int UnresolvedQuestionCount,
    InformationArchitectureRecordView? Candidate,
    string SnapshotDigest);
