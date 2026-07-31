namespace Gaep.HostClient;

public sealed record HighLevelDesignRecordView(
    Guid Id, long Revision, string Digest, string StructureReceiptDigest, string DependencyReceiptDigest,
    string TraceReceiptDigest, string CoverageReceiptDigest, string OwnershipReceiptDigest,
    string AssessmentReceiptDigest, int ElementCount, int RelationCount, int DecisionCount, string ReviewState);

public sealed record HighLevelDesignProjection(
    Guid ProductId, long ProductRevision, string ProductDigest, Guid InitiativeId, long InitiativeRevision,
    string InitiativeDigest, string InitiativeState, string State, string ReviewState, IReadOnlyList<string> Reasons,
    int DependencyCount, int PresentDependencyCount, int ElementCount, int DefinedElementCount,
    int RelationCount, int DefinedRelationCount, int DecisionCount, int SelectedDecisionCount,
    int QualityAttributeCount, int DeploymentViewCount, int ConflictCount, int MissingCount,
    int OrphanRelationCount, int TraceGapCount, int EvidenceGapCount, int OwnershipGapCount,
    int UncoveredUnitCount, int StaleBindingCount, int StaleDependencyCount, int InvalidCandidateCount,
    int UnresolvedQuestionCount, HighLevelDesignRecordView? Candidate, string SnapshotDigest);
