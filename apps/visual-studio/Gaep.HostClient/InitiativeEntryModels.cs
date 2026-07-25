namespace Gaep.HostClient;

public sealed record InitiativeClassificationCharacteristics(
    string UserInterface,
    string Data,
    string Integration,
    IReadOnlyList<string> InteractionModes,
    string Exposure);

public sealed record InitiativeClassificationRisk(
    string BlastRadius,
    string Reversibility,
    string Urgency,
    string CostOfFailure);

public sealed record InitiativeClassificationConfidence(string Level, string Basis);

public sealed record InitiativeEntrySource(string Kind, string Reference, string? Digest = null);

public sealed record InitiativeClassificationInput(
    string PrimaryType,
    IReadOnlyList<string> SecondaryTypes,
    string SystemState,
    string ChangePosture,
    IReadOnlyList<string> Motivations,
    InitiativeClassificationCharacteristics Characteristics,
    bool Regulated,
    IReadOnlyList<string> PolicyDomains,
    IReadOnlyList<string> Sensitivities,
    string ExpectedLifetime,
    string MaintenanceHorizon,
    InitiativeClassificationRisk Risk,
    IReadOnlyList<string> Dependencies,
    IReadOnlyList<string> AffectedAssets,
    string Owner,
    string AccountableAuthority,
    InitiativeClassificationConfidence Confidence,
    IReadOnlyList<InitiativeEntrySource> Evidence,
    IReadOnlyList<string> UnresolvedQuestions,
    string Rationale);

public sealed record InitiativeApplicabilitySubject(string Type, string Key, string Label);

public sealed record InitiativeApplicabilityApproval(
    string State,
    IReadOnlyList<string> Conditions,
    string? DecidedBy = null,
    DateTimeOffset? DecidedAt = null);

public sealed record InitiativeRelatedRecord(
    string RecordType,
    Guid RecordId,
    long Revision,
    string Digest);

public sealed record InitiativeApplicabilityDecisionInput(
    InitiativeApplicabilitySubject Subject,
    string Status,
    string Rationale,
    IReadOnlyList<InitiativeEntrySource> Sources,
    string Owner,
    string? AccountableApprover,
    IReadOnlyList<string> Dependencies,
    IReadOnlyList<string> Conditions,
    IReadOnlyList<string> ReviewTriggers,
    InitiativeApplicabilityApproval Approval,
    IReadOnlyList<InitiativeRelatedRecord> RelatedRecords,
    IReadOnlyList<string> RelatedImplementationUnits);

public sealed record InitiativeUnresolvedSubject(
    InitiativeApplicabilitySubject Subject,
    string Reason,
    string Owner);

public sealed record InitiativeApplicabilityMatrixInput(
    IReadOnlyList<InitiativeApplicabilityDecisionInput> Decisions,
    IReadOnlyList<InitiativeUnresolvedSubject> UnresolvedSubjects);

public sealed record InitiativeClassificationView(
    string PrimaryType,
    string ProductProfile,
    long ProductRevision,
    string ProductDigest,
    string ClassifiedBy,
    DateTimeOffset ClassifiedAt,
    string Digest,
    string InputDigest);

public sealed record InitiativeApplicabilityView(
    long Revision,
    long InitiativeRevision,
    string State,
    int DecisionCount,
    int UnresolvedSubjectCount,
    string ClassificationDigest,
    string EvaluatedBy,
    DateTimeOffset EvaluatedAt,
    string Digest,
    string InputDigest);

public sealed record InitiativeEntryRecord(
    Guid Id,
    long Revision,
    Guid ProductId,
    string State,
    InitiativeClassificationView? Classification,
    InitiativeApplicabilityView? Applicability);

public sealed record InitiativeEntryAssessmentClassification(string Status, string? Digest);

public sealed record InitiativeEntryAssessmentApplicability(
    string Status,
    long? MatrixRevision,
    string? Digest,
    int DecisionCount,
    int UnresolvedSubjectCount,
    int PendingHumanDecisionCount,
    int BlockedDecisionCount,
    int PendingApprovalCount,
    int RejectedApprovalCount);

public sealed record InitiativeEntryAssessment(
    Guid InitiativeId,
    long InitiativeRevision,
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    InitiativeEntryAssessmentClassification Classification,
    InitiativeEntryAssessmentApplicability Applicability,
    string State,
    IReadOnlyList<string> Reasons,
    DateTimeOffset AssessedAt);

public sealed record InitiativeEntryContext(
    InitiativeEntryRecord Initiative,
    InitiativeEntryAssessment Assessment);
