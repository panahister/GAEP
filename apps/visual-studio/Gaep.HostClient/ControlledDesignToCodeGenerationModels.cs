namespace Gaep.HostClient;

public sealed record ControlledDesignToCodeGenerationRecordView(
    Guid Id, long Revision, string Digest, string SelectedProvider, string AdapterId, string AgentId, string ModelId,
    string BaselineSemanticVersion, string ContentBoundary, string MaterializationState, string TransferState,
    int TargetCount, int ImplementationUnitCount, int PathCount, string FigmaAccessState, string ProviderExecutionState,
    string GeneratedOutputState, string OutputInspectionState, string RealStageCreationState, string SourceMutationState,
    string ReviewState);

public sealed record ControlledDesignToCodeGenerationProjection(
    Guid ProductId, long ProductRevision, string ProductDigest,
    Guid InitiativeId, long InitiativeRevision, string InitiativeDigest, string InitiativeState,
    string State, string ReviewState, IReadOnlyList<string> Reasons, string? SelectedProvider,
    int TargetCount, int ImplementationUnitCount, int PathCount, int ExpectedTraceCount, int ExpectedTestOutputCount,
    int StaleBindingCount, int TargetGapCount, int ProviderGapCount, int ContextGapCount, int LifecycleGapCount,
    int PrerequisiteGapCount, int EvidenceGapCount, int InvalidCandidateCount, int UnresolvedQuestionCount,
    ControlledDesignToCodeGenerationRecordView? Candidate, string SnapshotDigest);
