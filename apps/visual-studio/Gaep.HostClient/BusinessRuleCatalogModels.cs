namespace Gaep.HostClient;

public sealed record BusinessRuleCatalogRecordView(
    Guid Id,
    long Revision,
    string Digest,
    int RuleCount,
    int EnforcementTargetCount,
    int ExceptionCount,
    int NonExceptionableRuleCount);

public sealed record BusinessRuleCatalogProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int RuleCount,
    int SourceBackedRuleCount,
    int NonExceptionableRuleCount,
    int EnforcementTargetCount,
    int UnassignedEnforcementTargetCount,
    int UnverifiedEnforcementTargetCount,
    int ExceptionCount,
    int UnassignedExceptionAuthorityCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    BusinessRuleCatalogRecordView? BusinessRuleCatalog,
    string SnapshotDigest);
