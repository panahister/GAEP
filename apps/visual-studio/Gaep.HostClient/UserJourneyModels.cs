namespace Gaep.HostClient;

public sealed record UserJourneyRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int JourneyCount,
    int TouchpointCount,
    string ReviewState);

public sealed record UserJourneyProjection(
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
    int JourneyCount,
    int TouchpointCount,
    int PrimaryPathCount,
    int SuccessPathCount,
    int FailurePathCount,
    int RecoveryPathCount,
    int RepresentedScopeCount,
    int UnresolvedScopeCount,
    int WeakEvidencePathCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    int UnresolvedQuestionCount,
    UserJourneyRecordView? Candidate,
    string SnapshotDigest);
