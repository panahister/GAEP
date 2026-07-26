namespace Gaep.HostClient;

public sealed record DecisionRegisterRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int DecisionCount);

public sealed record DecisionRegisterProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int DecisionCount,
    int UnresolvedDecisionCount,
    int SelectedPendingDecisionCount,
    int DeferredDecisionCount,
    int UnresolvedRequirementCount,
    int InconsistencyCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    DecisionRegisterRecordView? Register,
    string SnapshotDigest);
