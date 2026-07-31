namespace Gaep.HostClient;

public sealed record StagingWorkspaceRecordView(
    Guid Id, long Revision, string Digest, string StageKey, int Generation,
    string ActualStageExistenceState, string InspectionState, int CandidateFileCount,
    int MaximumFiles, long CandidateByteCount, long MaximumBytes, string RecoveryState,
    string RecoveryCheckpointDigest, string InspectionReceiptDigest, int UnitCount, string ReviewState);

public sealed record StagingWorkspaceProjection(
    Guid ProductId, long ProductRevision, string ProductDigest,
    Guid InitiativeId, long InitiativeRevision, string InitiativeDigest, string InitiativeState,
    string State, string ReviewState, IReadOnlyList<string> Reasons,
    int PreviewUnitCount, int PreviewPathCount, int StagingUnitCount, int StagingPathCount,
    int CandidateDefinedCount, int UnavailableCount, int GapCount, int ConflictCount, int StaleCount,
    int NotAssessedCount, int OrphanUnitCount, int OrphanPathCount, int InspectionGapCount,
    int ExclusionGapCount, int CapacityGapCount, int RecoveryGapCount, int EvidenceGapCount,
    int StaleBindingCount, int StalePreviewCount, int InvalidCandidateCount, int UnresolvedQuestionCount,
    StagingWorkspaceRecordView? Candidate, string SnapshotDigest);
