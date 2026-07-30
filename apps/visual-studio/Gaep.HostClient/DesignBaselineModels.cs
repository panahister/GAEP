namespace Gaep.HostClient;

public sealed record DesignBaselineApprovalView(
    Guid RecordId,
    long Revision,
    string Digest,
    string MembershipDigest,
    string DecisionReceiptDigest,
    string SubjectDigest,
    string ScopeDigest,
    string AssessmentDigest,
    string AssessmentState);

public sealed record DesignBaselinePredecessorView(
    Guid RecordId,
    long Revision,
    string Digest,
    string MembershipDigest,
    Guid BaselineLineageId,
    string SemanticVersion);

public sealed record DesignBaselineRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    DesignBaselineApprovalView Approval,
    HumanDesignApprovalSubjectView Subject,
    string ScopeDigest,
    Guid BaselineLineageId,
    Guid CandidateSetId,
    long CandidateSetRevision,
    string SemanticVersion,
    string VersionPolicyDigest,
    string DesignationDefinitionDigest,
    string DesignationReceiptDigest,
    string? DesignationKind,
    string? DesignationDigest,
    DesignBaselinePredecessorView? Supersedes,
    string CandidateResult,
    string ReviewState);

public sealed record DesignBaselineProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string CandidateResult,
    string ReviewState,
    string AssessmentState,
    int CandidateSetCount,
    int DesignationCandidateCount,
    int SupersessionCandidateCount,
    int WithdrawalCandidateCount,
    int RestorationCandidateCount,
    int ExpiredDesignationCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    int UnresolvedQuestionCount,
    string ApprovalDeterminationState,
    string BaselineDesignationState,
    IReadOnlyList<string> Reasons,
    DesignBaselineRecordView? Candidate,
    string SnapshotDigest);
