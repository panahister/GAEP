namespace Gaep.HostClient;

public sealed record ProviderSwitchImplementationRecordView(
    Guid Id, long Revision, string Digest, string Direction,
    string SourceAdapterId, string SourceAgentId, string SourceModelId,
    string TargetAdapterId, string TargetAgentId, string TargetModelId,
    string HandoffState, string ProviderTransitionState, string StageOwnershipState, string ResumeState,
    string SourceMutationState, string ApplyState, string DiscardState, string RecoveryState,
    int UnitCount, int PathCount, int PrerequisiteCount, string ReviewState);

public sealed record ProviderSwitchImplementationProjection(
    Guid ProductId, long ProductRevision, string ProductDigest,
    Guid InitiativeId, long InitiativeRevision, string InitiativeDigest, string InitiativeState,
    string State, string ReviewState, IReadOnlyList<string> Reasons, int UnitCount, int PathCount,
    int CandidateDefinedCount, int GapCount, int StaleBindingCount, int ProviderGapCount,
    int ContinuityGapCount, int HandoffGapCount, int PrerequisiteGapCount, int EvidenceGapCount,
    int InvalidCandidateCount, int UnresolvedQuestionCount, ProviderSwitchImplementationRecordView? Candidate, string SnapshotDigest);
