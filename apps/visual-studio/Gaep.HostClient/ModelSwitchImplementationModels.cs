namespace Gaep.HostClient;

public sealed record ModelSwitchImplementationRecordView(
    Guid Id, long Revision, string Digest, string Provider, string ProviderSwitchRole,
    string AdapterId, string AgentId, string SourceModelId, string TargetModelId, string CapabilityDigest,
    string TransitionState, string TargetModelAvailabilityState, string CapabilityRefreshState, string ContextTransferState,
    string ModelTransitionState, string ProviderExecutionState, string HandoffState, string StageOwnershipState, string ResumeState,
    string SourceMutationState, string ApplyState, string DiscardState, string RecoveryState,
    int UnitCount, int PathCount, int PrerequisiteCount, string ReviewState);

public sealed record ModelSwitchImplementationProjection(
    Guid ProductId, long ProductRevision, string ProductDigest,
    Guid InitiativeId, long InitiativeRevision, string InitiativeDigest, string InitiativeState,
    string State, string ReviewState, IReadOnlyList<string> Reasons, int UnitCount, int PathCount,
    int StaleBindingCount, int ProviderGapCount, int ModelGapCount, int ContinuityGapCount,
    int TransitionGapCount, int PrerequisiteGapCount, int EvidenceGapCount, int InvalidCandidateCount,
    int UnresolvedQuestionCount, ModelSwitchImplementationRecordView? Candidate, string SnapshotDigest);
