namespace Gaep.HostClient;

public sealed record ControlledCodexImplementationRecordView(
    Guid Id, long Revision, string Digest, string AdapterId, string AgentId, string ModelId,
    string CapabilityDigest, string PlanKey, string ProviderExecutionState, string RealStageCreationState,
    string SourceMutationState, string ApplyState, string DiscardState, int UnitCount, int PathCount,
    int PrerequisiteCount, string ReviewState);

public sealed record ControlledCodexImplementationProjection(
    Guid ProductId, long ProductRevision, string ProductDigest,
    Guid InitiativeId, long InitiativeRevision, string InitiativeDigest, string InitiativeState,
    string State, string ReviewState, IReadOnlyList<string> Reasons, int UnitCount, int PathCount,
    int ResourceScopeCount, int ToolPermissionCount, int CandidateDefinedCount, int GapCount,
    int StaleBindingCount, int ProviderGapCount, int ScopeGapCount, int PlanGapCount,
    int PrerequisiteGapCount, int RecoveryGapCount, int EvidenceGapCount, int InvalidCandidateCount,
    int UnresolvedQuestionCount, ControlledCodexImplementationRecordView? Candidate, string SnapshotDigest);
