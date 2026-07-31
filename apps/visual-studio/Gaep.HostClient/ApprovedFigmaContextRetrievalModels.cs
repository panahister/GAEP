namespace Gaep.HostClient;

public sealed record ApprovedFigmaContextRetrievalRecordView(
    Guid Id, long Revision, string Digest, string BaselineSemanticVersion, string ReturnedExternalVersionDigest,
    int SnapshotItemCount, int IncludedItemCount, string ContentBoundary, string MaterializationState, string TransferState,
    string FigmaConnectionState, string RemoteFetchState, string ContextMaterializationState, string ContextTransferState,
    string GenerationState, string ProviderExecutionState, string StageEffectState, string SourceMutationState, string ReviewState);

public sealed record ApprovedFigmaContextRetrievalProjection(
    Guid ProductId, long ProductRevision, string ProductDigest,
    Guid InitiativeId, long InitiativeRevision, string InitiativeDigest, string InitiativeState,
    string State, string ReviewState, IReadOnlyList<string> Reasons, int SnapshotItemCount, int IncludedItemCount,
    int RequirementBindingCount, int DesignToCodeBindingCount, int RouteSubjectCount, int ImplementationUnitCount, int PathCount,
    int StaleBindingCount, int SnapshotGapCount, int GenerationContextGapCount, int LifecycleGapCount,
    int EvidenceGapCount, int InvalidCandidateCount, int UnresolvedQuestionCount,
    ApprovedFigmaContextRetrievalRecordView? Candidate, string SnapshotDigest);
