namespace Gaep.HostClient;

public sealed record ArchitectureChallengeModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int ChallengeSubjectCount,
    int AssumptionCount,
    int AlternativeCount,
    int FindingCount,
    int ResponseCount);

public sealed record ArchitectureChallengeModelProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int ChallengeSubjectCount,
    int AssumptionCount,
    int AlternativeCount,
    int FindingCount,
    int ResponseCount,
    int UnrespondedFindingCount,
    int UnresolvedAssumptionCount,
    int UnresolvedRequirementCount,
    int InconsistencyCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    ArchitectureChallengeModelRecordView? Model,
    string SnapshotDigest);
