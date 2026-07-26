namespace Gaep.HostClient;

public sealed record AuthorizationModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int PrincipalCount,
    int ActionCount,
    int RuleCount);

public sealed record AuthorizationModelProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int PrincipalCount,
    int RoleAssignmentCount,
    int ResourceCount,
    int ActionCount,
    int ApprovalBindingCount,
    int RuleCount,
    int UncoveredOperatingRoleCount,
    int UncoveredProcessCount,
    int UncoveredDataEntityCount,
    int UnresolvedIdentityCount,
    int UnresolvedRuleCount,
    int UnresolvedRequirementCount,
    int InconsistencyCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    AuthorizationModelRecordView? Model,
    string SnapshotDigest);
