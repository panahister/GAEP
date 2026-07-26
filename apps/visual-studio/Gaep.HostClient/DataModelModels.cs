namespace Gaep.HostClient;

public sealed record DataModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int EntityCount,
    int RelationshipCount,
    int LifecycleCount);

public sealed record DataModelProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int EntityCount,
    int AttributeCount,
    int RelationshipCount,
    int LifecycleCount,
    int TransformationCount,
    int UncoveredBoundedContextCount,
    int UncoveredSecurityDataClassCount,
    int UncoveredProcessCount,
    int UnresolvedSystemOfRecordCount,
    int UnresolvedTransformationCount,
    int UnresolvedRequirementCount,
    int InconsistencyCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    DataModelRecordView? Model,
    string SnapshotDigest);
