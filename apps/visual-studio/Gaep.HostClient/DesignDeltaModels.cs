namespace Gaep.HostClient;

public sealed record DesignDeltaDesignerReadyBindingView(
    Guid RecordId,
    long Revision,
    string Digest,
    string MembershipDigest,
    string PrerequisiteCatalogDigest,
    string AssessmentReceiptDigest,
    string CandidateResult);

public sealed record DesignDeltaDependencyBindingView(
    Guid RecordId,
    long Revision,
    string Digest,
    string MembershipDigest,
    string CatalogDigest,
    string ReconciliationDigest,
    string ReviewState);

public sealed record DesignDeltaRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    DesignDeltaDesignerReadyBindingView DesignerReadyGate,
    DesignDeltaDependencyBindingView FinalizedSnapshot,
    DesignDeltaDependencyBindingView DesignBinding,
    string SourceSnapshotDigest,
    string TargetSnapshotDigest,
    string ComparisonDefinitionDigest,
    string ComparisonReceiptDigest,
    string DeltaCatalogDigest,
    int DeltaCount,
    string ComparisonState,
    string ProvenanceState,
    string CandidateResult,
    string ReviewState);

public sealed record DesignDeltaProjection(
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
    string ComparisonState,
    string ProvenanceState,
    IReadOnlyList<string> Reasons,
    int SourceItemCount,
    int TargetItemCount,
    int DeltaCount,
    int AddedCount,
    int ChangedCount,
    int ConflictingCount,
    int MissingCount,
    int StaleCount,
    int UnmappedCount,
    int HumanReviewedCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    int UnresolvedMappingCount,
    int UnresolvedQuestionCount,
    DesignDeltaRecordView? Candidate,
    string SnapshotDigest);
