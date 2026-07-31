namespace Gaep.HostClient;

public sealed record ChangedUnitInventoryRecordView(
    Guid Id, long Revision, string Digest, string DependencyReceiptDigest, string InventoryReceiptDigest,
    string TraceReceiptDigest, string BlastRadiusReceiptDigest, string EvidenceReceiptDigest,
    string OwnershipReceiptDigest, string AssessmentReceiptDigest, int UnitCount, string ReviewState);

public sealed record ChangedUnitInventoryProjection(
    Guid ProductId, long ProductRevision, string ProductDigest, Guid InitiativeId, long InitiativeRevision,
    string InitiativeDigest, string InitiativeState, string State, string ReviewState, IReadOnlyList<string> Reasons,
    int DependencyCount, int PresentDependencyCount, int SourceUnitCount, int InventoryUnitCount, int PathCandidateCount,
    int CandidateScopedCount, int GapCount, int ConflictCount, int StaleCount, int NotAssessedCount, int OrphanUnitCount,
    int TraceGapCount, int EvidenceGapCount, int OwnershipGapCount, int BlastRadiusGapCount, int StaleBindingCount,
    int StaleDependencyCount, int InvalidCandidateCount, int UnresolvedQuestionCount,
    ChangedUnitInventoryRecordView? Candidate, string SnapshotDigest);
