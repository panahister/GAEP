namespace Gaep.HostClient;

public sealed record ImplementationReadinessGateRecordView(
    Guid Id, long Revision, string Digest, string DependencyReceiptDigest, string CoverageReceiptDigest,
    string EvidenceReceiptDigest, string OwnershipReceiptDigest, string AssessmentReceiptDigest,
    int SubjectCount, string ReviewState);

public sealed record ImplementationReadinessGateProjection(
    Guid ProductId, long ProductRevision, string ProductDigest, Guid InitiativeId, long InitiativeRevision,
    string InitiativeDigest, string InitiativeState, string State, string ReviewState, IReadOnlyList<string> Reasons,
    int DependencyCount, int PresentDependencyCount, int SubjectCount, int SatisfiedCount, int GapCount,
    int ConflictCount, int StaleCount, int WaivedCandidateCount, int NotAssessedCount, int EvidenceGapCount,
    int OwnershipGapCount, int CoverageGapCount, int StaleBindingCount, int StaleDependencyCount,
    int InvalidCandidateCount, int UnresolvedQuestionCount, ImplementationReadinessGateRecordView? Candidate, string SnapshotDigest);
