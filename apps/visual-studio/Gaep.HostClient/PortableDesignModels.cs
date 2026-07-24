namespace Gaep.HostClient;

public enum PortableDesignClassification
{
    Public,
    Internal,
    Confidential,
    Restricted,
}

public enum PortableDesignSourceReviewStatus
{
    Unreviewed,
    Reviewed,
    Approved,
}

public enum PortableDesignExportMethod
{
    ManualExport,
    DesignToolExport,
    PluginExport,
}

public sealed record PortableDesignGovernanceMetadata(
    string State,
    bool HumanReviewRequired,
    string ClaimBoundary,
    string NonEscalation);

public sealed record PortableDesignSourceReviewMetadata(
    PortableDesignSourceReviewStatus Status,
    string ClaimLabel,
    bool GaepApproval);

public sealed record PortableDesignSourceMetadata(
    string Tool,
    PortableDesignExportMethod ExportMethod);

public sealed record PortableDesignCounts(
    int Artifacts,
    int NormalizedDesignTokens,
    int ValidationChecks,
    int RecordedLimitations);

public sealed record PortableDesignDigests(
    string Snapshot,
    string Evidence,
    string Manifest,
    string ArtifactInventory);

public sealed record PortableDesignTimestamps(
    DateTimeOffset SourceExportedAt,
    DateTimeOffset ImportedAt);

public sealed record PortableDesignSnapshotSummary(
    int SchemaVersion,
    string Kind,
    Guid BundleId,
    Guid ProductId,
    Guid? InitiativeId,
    string Title,
    PortableDesignClassification Classification,
    PortableDesignGovernanceMetadata Governance,
    PortableDesignSourceReviewMetadata SourceReview,
    PortableDesignSourceMetadata Source,
    PortableDesignCounts Counts,
    PortableDesignDigests Digests,
    PortableDesignTimestamps Timestamps,
    string PrivacyBoundary);

public sealed record PortableDesignSnapshotPage(
    IReadOnlyList<PortableDesignSnapshotSummary> Items,
    int Offset,
    int Limit,
    int Total,
    bool HasMore,
    string GovernanceBoundary,
    string PrivacyBoundary);

public sealed class EngineHostException : Exception
{
    internal EngineHostException(int code, string kind, string message)
        : base(message)
    {
        Code = code;
        Kind = kind;
    }

    public int Code { get; }

    public string Kind { get; }
}
