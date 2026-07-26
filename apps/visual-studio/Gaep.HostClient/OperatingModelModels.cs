namespace Gaep.HostClient;

public sealed record OperatingModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    int RoleCount,
    int DecisionRightCount,
    int ForumCount,
    int CycleCount);

public sealed record OperatingModelProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int RoleCount,
    int GovernanceSystemCount,
    int UnassignedAppointingAuthorityCount,
    int InsufficientCapacityCount,
    int UnfundedCapacityCount,
    int DecisionRightCount,
    int UnassignedDecisionAuthorityCount,
    int ForumCount,
    int CycleCount,
    int SupportCapacityGapCount,
    int EmergencyAuthorityGapCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    OperatingModelRecordView? OperatingModel,
    string SnapshotDigest);
