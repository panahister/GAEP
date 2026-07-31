namespace Gaep.HostClient;

public sealed record ControlledClaudeImplementationRecordView(
    Guid Id, long Revision, string Digest, string AdapterId, string AgentId, string ModelId,
    string CapabilityDigest, string PlanKey, string ProviderExecutionState, string RealStageCreationState,
    string SourceMutationState, string ApplyState, string DiscardState, int UnitCount, int PathCount,
    int PrerequisiteCount, string ReviewState, string RuntimeMode, string SupportedRuntimeState,
    string AuthenticationState, string EffectivePolicyState, string CredentialAccessState,
    string AdministratorPolicyBypassState, string WorkspaceAccessState, string ToolAccessState,
    string ResumeCapabilityState);

public sealed record ControlledClaudeImplementationProjection(
    Guid ProductId, long ProductRevision, string ProductDigest,
    Guid InitiativeId, long InitiativeRevision, string InitiativeDigest, string InitiativeState,
    string State, string ReviewState, IReadOnlyList<string> Reasons, int UnitCount, int PathCount,
    int ResourceScopeCount, int ToolPermissionCount, int CandidateDefinedCount, int GapCount,
    int StaleBindingCount, int ProviderGapCount, int ScopeGapCount, int PlanGapCount,
    int PrerequisiteGapCount, int RecoveryGapCount, int EvidenceGapCount, int InvalidCandidateCount,
    int UnresolvedQuestionCount, ControlledClaudeImplementationRecordView? Candidate, string SnapshotDigest);
