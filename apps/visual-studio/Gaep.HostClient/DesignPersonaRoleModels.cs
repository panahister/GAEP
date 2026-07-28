namespace Gaep.HostClient;

public sealed record DesignPersonaRoleRecordView(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    int PersonaCount,
    int DesignRoleCount,
    string ReviewState);

public sealed record DesignPersonaRoleProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    string ReviewState,
    IReadOnlyList<string> Reasons,
    int PersonaCount,
    int DesignRoleCount,
    int RepresentedParticipantCategoryCount,
    int UnresolvedParticipantCategoryCount,
    int RepresentedRoleKindCount,
    int UnresolvedRoleKindCount,
    int WeakEvidencePersonaCount,
    int HumanReviewedPersonaCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    int UnresolvedQuestionCount,
    DesignPersonaRoleRecordView? Candidate,
    string SnapshotDigest);
