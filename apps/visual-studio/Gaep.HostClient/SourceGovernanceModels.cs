namespace Gaep.HostClient;

public sealed record SourceGovernanceSourceView(
    Guid Id,
    long Revision,
    string Title,
    string SourceType,
    string Owner,
    string SemanticAuthority,
    string KnowledgeDisposition,
    string InformationClassification,
    string Freshness,
    string Availability);

public sealed record SourceGovernanceBaselineView(
    Guid Id,
    long Revision,
    string Title,
    int MemberCount,
    string AssessmentStatus);

public sealed record SourceGovernanceProvenanceView(
    Guid Id,
    string TargetKind,
    string Disposition,
    int SourceCount,
    int TransformationCount);

public sealed record SourceGovernanceCurrentBaseline(
    Guid Id,
    long Revision,
    string Digest,
    string MembershipDigest,
    string Status,
    int MemberCount);

public sealed record SourceGovernanceProjection(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string AssessmentState,
    IReadOnlyList<string> Reasons,
    int SourceCount,
    int BaselineCount,
    int ProvenanceCount,
    int StaleSourceCount,
    int UnknownAuthorityCount,
    int UnbaselinedSourceCount,
    int UnprovenancedSourceCount,
    SourceGovernanceCurrentBaseline? CurrentBaseline,
    IReadOnlyList<SourceGovernanceSourceView> Sources,
    IReadOnlyList<SourceGovernanceBaselineView> Baselines,
    IReadOnlyList<SourceGovernanceProvenanceView> Provenance,
    string SnapshotDigest);
