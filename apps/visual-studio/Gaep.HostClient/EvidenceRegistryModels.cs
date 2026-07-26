namespace Gaep.HostClient;

public sealed record EvidenceRegistryRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int ClaimCount,
    int EvidenceItemCount,
    int LinkCount);

public sealed record EvidenceRegistryProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int ClaimCount,
    int EvidenceItemCount,
    int LinkCount,
    int NotAssessedClaimCount,
    int NotAssessedEvidenceCount,
    int AdverseEvidencePendingDispositionCount,
    int StaleOrUnknownEvidenceCount,
    int InvalidatedEvidenceCount,
    int UnresolvedLinkCount,
    int UnresolvedRequirementCount,
    int InconsistencyCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    EvidenceRegistryRecordView? Registry,
    string SnapshotDigest);
