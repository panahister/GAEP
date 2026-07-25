namespace Gaep.HostClient;

public sealed record BusinessUnderstandingRecordView(
    Guid Id,
    long Revision,
    string Digest,
    int ObjectiveCount,
    int ConstraintCount,
    int AssumptionCount,
    int UnresolvedQuestionCount,
    int GlossaryTermCount);

public sealed record StakeholderModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    int StakeholderCount,
    int RepresentedCategoryCount,
    int UnresolvedCategoryCount,
    int VerifiedAuthorityCount);

public sealed record OutcomeModelRecordView(
    Guid Id,
    long Revision,
    string Digest,
    int OutcomeCount,
    int MeasureCount,
    int CountermetricCount,
    int BurdenMeasureCount,
    int ObservedBaselineCount);

public sealed record BusinessUnderstandingProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int UnresolvedQuestionCount,
    int BlockingQuestionCount,
    int StaleBindingCount,
    int StaleSourceReferenceCount,
    BusinessUnderstandingRecordView? BusinessUnderstanding,
    StakeholderModelRecordView? StakeholderModel,
    OutcomeModelRecordView? OutcomeModel,
    string SnapshotDigest);
