namespace Gaep.HostClient;

public sealed record RiskRegisterRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int RiskCount);

public sealed record RiskRegisterProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int RiskCount,
    int NotAssessedRiskCount,
    int UnresolvedResidualRiskCount,
    int ProposedTreatmentCount,
    int UnassignedOwnerCount,
    int UnverifiedControlCount,
    int UnresolvedRequirementCount,
    int InconsistencyCount,
    int UnresolvedQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    RiskRegisterRecordView? Register,
    string SnapshotDigest);
