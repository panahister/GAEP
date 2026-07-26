namespace Gaep.HostClient;

public sealed record BoundedContextModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int BoundedContextCount,
    int ContractCount,
    int RelationshipCount);

public sealed record BoundedContextModelProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int BoundedContextCount,
    int CoreContextCount,
    int LanguageTermCount,
    int ContractCount,
    int UnresolvedContractCount,
    int RelationshipCount,
    int UnresolvedRelationshipCount,
    int UnassignedArchitectureElementCount,
    int UnownedDataAssetCount,
    int UnmappedCrossContextRelationCount,
    int InconsistencyCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    BoundedContextModelRecordView? Model,
    string SnapshotDigest);
