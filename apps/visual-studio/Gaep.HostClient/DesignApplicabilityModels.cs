namespace Gaep.HostClient;

public sealed record DesignApplicabilityRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int ScopeCount,
    string ReviewState);

public sealed record DesignApplicabilityProjection(
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
    int ScopeCount,
    int DecisionCount,
    int UnresolvedDecisionCount,
    int BlockedDecisionCount,
    int PendingApprovalCount,
    int RejectedApprovalCount,
    int UnresolvedDepthCount,
    int UnresolvedSourceCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    int UnresolvedQuestionCount,
    DesignApplicabilityRecordView? Candidate,
    string SnapshotDigest);
