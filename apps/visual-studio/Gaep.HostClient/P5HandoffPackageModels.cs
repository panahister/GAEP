namespace Gaep.HostClient;

public sealed record P5HandoffPackageRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    string ReadinessStatusDigest,
    int ItemCount,
    int RequirementCount,
    string DeliveryMode);

public sealed record P5HandoffPackageProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    string ReadinessResult,
    string TransferState,
    IReadOnlyList<string> Reasons,
    int ItemCount,
    int IncludedItemCount,
    int ReferenceOnlyItemCount,
    int OmittedNotApplicableItemCount,
    int UnresolvedItemCount,
    int StaleOrUnknownItemCount,
    int LossyTransformationCount,
    int UnresolvedRequirementCount,
    int ConflictCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    string HandoffBoundary,
    P5HandoffPackageRecordView? Handoff,
    string SnapshotDigest);
