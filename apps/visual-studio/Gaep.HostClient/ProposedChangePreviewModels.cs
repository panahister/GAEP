namespace Gaep.HostClient;

public sealed record ProposedChangePreviewRecordView(
    Guid Id, long Revision, string Digest, string DependencyReceiptDigest, string PlanReceiptDigest,
    string DiffReceiptDigest, string TraceReceiptDigest, string EvidenceReceiptDigest,
    string AssessmentReceiptDigest, int UnitCount, string ReviewState);

public sealed record ProposedChangePreviewProjection(
    Guid ProductId, long ProductRevision, string ProductDigest, Guid InitiativeId, long InitiativeRevision,
    string InitiativeDigest, string InitiativeState, string State, string ReviewState, IReadOnlyList<string> Reasons,
    int InventoryUnitCount, int InventoryPathCount, int PreviewUnitCount, int PreviewPathCount,
    int CandidatePreviewedCount, int GapCount, int ConflictCount, int StaleCount, int NotAssessedCount,
    int OrphanUnitCount, int OrphanPathCount, int EndpointGapCount, int DiffGapCount, int TraceGapCount,
    int EvidenceGapCount, int StaleBindingCount, int StaleInventoryCount, int InvalidCandidateCount,
    int UnresolvedQuestionCount, ProposedChangePreviewRecordView? Candidate, string SnapshotDigest);
