namespace Gaep.HostClient;

public sealed record ProcessModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int ProcessCount,
    int TransitionCount,
    int ApprovalRequirementCount);

public sealed record ProcessModelProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int ProcessCount,
    int StepCount,
    int StateDimensionCount,
    int StateValueCount,
    int TransitionCount,
    int EventDefinitionCount,
    int ApprovalRequirementCount,
    int UncoveredValueStreamCount,
    int UncoveredBoundedContextCount,
    int UncoveredBusinessRuleCount,
    int UnresolvedRequirementCount,
    int InconsistencyCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    ProcessModelRecordView? Model,
    string SnapshotDigest);
