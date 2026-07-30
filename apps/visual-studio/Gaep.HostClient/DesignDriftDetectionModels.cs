namespace Gaep.HostClient;

public sealed record DesignDriftBaselineView(
    Guid RecordId,
    long Revision,
    string Digest,
    string MembershipDigest,
    Guid BaselineLineageId,
    Guid CandidateSetId,
    long CandidateSetRevision,
    string SemanticVersion,
    string DesignationReceiptDigest,
    string BaselineDesignationState);

public sealed record DesignDriftSnapshotView(
    Guid RecordId,
    long Revision,
    string Digest,
    string MembershipDigest,
    string ExternalFileIdentityDigest,
    string ReturnedExternalVersionDigest,
    string ItemCatalogDigest);

public sealed record DesignDriftCatalogView(
    Guid RecordId,
    long Revision,
    string Digest,
    string MembershipDigest,
    string CatalogDigest);

public sealed record DesignDriftTraceView(
    Guid RecordId,
    long Revision,
    string Digest,
    string MembershipDigest,
    string ReconciliationDigest);

public sealed record DesignDriftDetectionRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    DesignDriftBaselineView DesignBaseline,
    DesignDriftSnapshotView ReturnedFigmaSnapshot,
    DesignDriftCatalogView DesignRequirements,
    DesignDriftTraceView DesignTrace,
    long ImplementationTargetCatalogRevision,
    string ImplementationTargetCatalogDigest,
    string ComparisonPolicyDigest,
    string ComparisonDigest,
    int ImplementationTargetCount,
    int ObservationCount,
    int RemediationCandidateCount,
    string CandidateResult,
    string ReviewState);

public sealed record DesignDriftDetectionProjection(
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
    int ImplementationTargetCount,
    int HumanReviewedImplementationTargetCount,
    int ObservationCount,
    int HumanReviewedObservationCount,
    int RequirementToDesignCount,
    int DesignToImplementationCount,
    int ConformantCount,
    int DriftCount,
    int UnassessedCount,
    int BlockerCount,
    int HighSeverityCount,
    int RemediationCandidateCount,
    int ExpiredRemediationCandidateCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    int UnresolvedQuestionCount,
    IReadOnlyList<string> Reasons,
    DesignDriftDetectionRecordView? Candidate,
    string SnapshotDigest);
