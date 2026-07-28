namespace Gaep.HostClient;

public sealed record DesignRequirementsRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int RequirementCount,
    int RepresentedOutcomeCount,
    int WorkItemCount,
    string ReviewState);

public sealed record DesignRequirementsProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    string ReviewState,
    string CatalogCompletenessState,
    IReadOnlyList<string> Reasons,
    int RequirementCount,
    int MustPriorityCount,
    int RepresentedOutcomeCount,
    int UnresolvedOutcomeCount,
    int LinkedBacklogRequirementCount,
    int NotPlannedRequirementCount,
    int UnresolvedBacklogRequirementCount,
    int WorkItemCount,
    int WeakEvidenceRequirementCount,
    int StaleBindingCount,
    int StaleDomainReferenceCount,
    int StaleSourceReferenceCount,
    int UnresolvedQuestionCount,
    DesignRequirementsRecordView? Candidate,
    string SnapshotDigest);
