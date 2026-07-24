using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    internal const int ProtocolVersion = 2;
    internal const int MaxOffset = 10_000;
    internal const int MaxPageSize = 200;
    internal const int DefaultPageSize = 100;
    internal const long MaxSafeProductRevision = 9_007_199_254_740_991;
    private const string SummaryKind = "portable-design-snapshot-summary";
    private const string GovernanceState = "pending-human-review";
    private const string ClaimBoundary = "import-validation-is-not-design-approval-or-baseline";
    private const string NonEscalation = "not-gaep-approval-design-baseline-implementation-or-release-readiness";
    private const string SummaryPrivacyBoundary = "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state.";
    private const string PageGovernanceBoundary = "Every item remains pending human review; source review is an upstream claim only.";
    private const string PagePrivacyBoundary = "Items contain validated metadata and digests only; local paths and source content are omitted.";
    private static readonly JsonSerializerOptions StrictJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };
    private static readonly IReadOnlyDictionary<string, (int Code, string Message)> StableHostErrors =
        new Dictionary<string, (int Code, string Message)>(StringComparer.Ordinal)
        {
            ["PORTABLE_DESIGN_SOURCE_INVALID"] = (-32_030, "The local portable design bundle did not pass bounded validation."),
            ["PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED"] = (-32_031, "The portable design request no longer matches the exact Product revision."),
            ["PORTABLE_DESIGN_AUDIT_INVALID"] = (-32_032, "GAEP could not verify the governed audit boundary for this portable design request."),
            ["PORTABLE_DESIGN_INTEGRITY_INVALID"] = (-32_033, "GAEP could not verify the portable design snapshot inventory and metadata."),
            ["PORTABLE_DESIGN_CONFLICT"] = (-32_034, "The portable design snapshot identity conflicts with governed inventory."),
            ["PORTABLE_DESIGN_NOT_FOUND"] = (-32_035, "The requested portable design snapshot does not exist in the current Product."),
            ["INVALID_PARAMS"] = (-32_602, "The GAEP engine rejected the portable design request parameters."),
            ["PROTOCOL_UPGRADE_REQUIRED"] = (-32_021, "The GAEP engine requires protocol version 2 for portable design requests."),
            ["UNSUPPORTED_PROTOCOL_VERSION"] = (-32_020, "The GAEP engine does not support the requested portable design protocol version."),
            ["FRAME_TOO_LARGE"] = (-32_001, "The GAEP engine rejected a frame that exceeded the protocol boundary."),
            ["RESPONSE_TOO_LARGE"] = (-32_002, "The GAEP engine response exceeded the protocol boundary."),
            ["INVALID_UTF8"] = (-32_700, "The GAEP engine response was not valid UTF-8."),
        };

    internal static string NormalizeBundleRoot(string bundleRoot)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(bundleRoot);
        if (bundleRoot.Length > 32_768 || bundleRoot.Contains('\0') ||
            !Path.IsPathFullyQualified(bundleRoot) || IsNetworkPath(bundleRoot))
        {
            throw new ArgumentException("Portable design bundle root must be an absolute local folder.", nameof(bundleRoot));
        }
        var normalized = Path.GetFullPath(bundleRoot);
        if (!Directory.Exists(normalized))
        {
            throw new ArgumentException("Portable design bundle root must be an existing local folder.", nameof(bundleRoot));
        }
        return normalized;
    }

    internal static void ValidateProductRevision(long revision)
    {
        if (revision is < 1 or > MaxSafeProductRevision)
        {
            throw new ArgumentOutOfRangeException(nameof(revision), "Product revision must be a positive protocol-safe integer.");
        }
    }

    internal static string ValidateActorId(string actorId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(actorId);
        var normalized = actorId.Trim();
        if (normalized.Length > 256 || !ActorIdPattern().IsMatch(normalized))
        {
            throw new ArgumentException("Actor ID must be a portable human principal.", nameof(actorId));
        }
        return normalized;
    }

    internal static void ValidatePage(int offset, int limit)
    {
        if (offset is < 0 or > MaxOffset) throw new ArgumentOutOfRangeException(nameof(offset));
        if (limit is < 1 or > MaxPageSize) throw new ArgumentOutOfRangeException(nameof(limit));
    }

    internal static PortableDesignSnapshotSummary ParseSnapshotResponse(
        JsonElement envelope,
        Guid? expectedBundleId = null,
        Guid? expectedProductId = null)
    {
        var result = ReadResult(envelope);
        SnapshotWire wire;
        try
        {
            wire = result.Deserialize<SnapshotWire>(StrictJson)
                ?? throw new InvalidDataException("Portable design snapshot response is empty.");
        }
        catch (JsonException)
        {
            throw InvalidResponse();
        }
        var summary = ParseSnapshot(wire);
        if ((expectedBundleId.HasValue && summary.BundleId != expectedBundleId.Value) ||
            (expectedProductId.HasValue && summary.ProductId != expectedProductId.Value))
        {
            throw InvalidResponse();
        }
        return summary;
    }

    internal static ProductBinding ParseProductBindingResponse(JsonElement envelope)
    {
        var result = ReadResult(envelope);
        var properties = result.EnumerateObject().Select(property => property.Name).ToArray();
        if (properties.Distinct(StringComparer.Ordinal).Count() != properties.Length ||
            !result.TryGetProperty("id", out var idElement) || idElement.ValueKind != JsonValueKind.String ||
            !Guid.TryParseExact(idElement.GetString(), "D", out var id) || id == Guid.Empty ||
            !result.TryGetProperty("name", out var nameElement) || nameElement.ValueKind != JsonValueKind.String)
        {
            throw InvalidResponse();
        }
        var name = nameElement.GetString();
        var revision = 1L;
        if (result.TryGetProperty("revision", out var revisionElement) && !revisionElement.TryGetInt64(out revision))
        {
            throw InvalidResponse();
        }
        if (name is null || name.Length is < 1 or > 240 || name != name.Trim() || name.Any(char.IsControl) ||
            revision is < 1 or > MaxSafeProductRevision)
        {
            throw InvalidResponse();
        }
        return new ProductBinding(id, name, revision);
    }

    internal static PortableDesignSnapshotPage ParsePageResponse(JsonElement envelope, int expectedOffset, int expectedLimit)
    {
        var result = ReadResult(envelope);
        PageWire wire;
        try
        {
            wire = result.Deserialize<PageWire>(StrictJson)
                ?? throw new InvalidDataException("Portable design page response is empty.");
        }
        catch (JsonException)
        {
            throw InvalidResponse();
        }
        if (wire.Offset != expectedOffset || wire.Limit != expectedLimit || wire.Offset is < 0 or > MaxOffset ||
            wire.Limit is < 1 or > MaxPageSize || wire.Total < 0 || wire.Items is null ||
            wire.Items.Count > wire.Limit || wire.Items.Count > MaxPageSize ||
            (wire.Items.Count > 0 && (long)wire.Offset + wire.Items.Count > wire.Total) ||
            wire.HasMore != ((long)wire.Offset + wire.Items.Count < wire.Total) ||
            wire.GovernanceBoundary != PageGovernanceBoundary || wire.PrivacyBoundary != PagePrivacyBoundary)
        {
            throw InvalidResponse();
        }
        var items = wire.Items.Select(ParseSnapshot).ToArray();
        if (items.Select(item => item.BundleId).Distinct().Count() != items.Length) throw InvalidResponse();
        return new PortableDesignSnapshotPage(
            Array.AsReadOnly(items),
            wire.Offset,
            wire.Limit,
            wire.Total,
            wire.HasMore,
            PageGovernanceBoundary,
            PagePrivacyBoundary);
    }

    internal static EngineHostException HostUnavailable() => new(
        -32_603,
        "HOST_UNAVAILABLE",
        "The GAEP engine host could not complete the portable design request.");

    internal static EngineHostException InvalidResponse() => new(
        -32_603,
        "HOST_RESPONSE_INVALID",
        "The GAEP engine returned a portable design response that could not be verified.");

    internal static EngineHostException ProductContextChanged() => new(
        -32_031,
        "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED",
        "The portable design request no longer matches the exact Product revision.");

    private static JsonElement ReadResult(JsonElement envelope)
    {
        if (envelope.ValueKind != JsonValueKind.Object ||
            !envelope.TryGetProperty("jsonrpc", out var jsonRpc) || jsonRpc.GetString() != "2.0")
        {
            throw InvalidResponse();
        }
        if (envelope.TryGetProperty("error", out var error))
        {
            if (!HasOnlyProperties(envelope, "jsonrpc", "id", "error")) throw InvalidResponse();
            throw ParseHostError(error);
        }
        if (!HasOnlyProperties(envelope, "jsonrpc", "id", "result") ||
            !envelope.TryGetProperty("result", out var result) || result.ValueKind != JsonValueKind.Object)
        {
            throw InvalidResponse();
        }
        return result;
    }

    private static EngineHostException ParseHostError(JsonElement error)
    {
        if (error.ValueKind != JsonValueKind.Object || !HasOnlyProperties(error, "code", "message", "data") ||
            !error.TryGetProperty("code", out var codeElement) || !codeElement.TryGetInt32(out var code) ||
            !error.TryGetProperty("message", out var messageElement) || messageElement.ValueKind != JsonValueKind.String ||
            !error.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object ||
            !HasOnlyAllowedProperties(data, "kind", "detail") ||
            !data.TryGetProperty("kind", out var kindElement) || kindElement.ValueKind != JsonValueKind.String)
        {
            return InvalidResponse();
        }
        var rawKind = kindElement.GetString();
        if (rawKind is null || !StableHostErrors.TryGetValue(rawKind, out var stable))
        {
            return new EngineHostException(-32_603, "HOST_ERROR", "The GAEP engine could not complete the portable design request.");
        }
        if (code != stable.Code)
        {
            return InvalidResponse();
        }
        return new EngineHostException(stable.Code, rawKind, stable.Message);
    }

    private static PortableDesignSnapshotSummary ParseSnapshot(SnapshotWire wire)
    {
        if (wire.SchemaVersion != 1 || wire.Kind != SummaryKind ||
            !Guid.TryParseExact(wire.BundleId, "D", out var bundleId) ||
            !Guid.TryParseExact(wire.ProductId, "D", out var productId) || bundleId == Guid.Empty || productId == Guid.Empty ||
            (wire.InitiativeId is not null &&
                (!Guid.TryParseExact(wire.InitiativeId, "D", out var parsedInitiativeId) || parsedInitiativeId == Guid.Empty)) ||
            !ValidTitle(wire.Title) || wire.Governance is null || wire.SourceReview is null || wire.Source is null ||
            wire.Counts is null || wire.Digests is null || wire.Timestamps is null ||
            wire.Governance.State != GovernanceState || !wire.Governance.HumanReviewRequired ||
            wire.Governance.ClaimBoundary != ClaimBoundary || wire.Governance.NonEscalation != NonEscalation ||
            wire.SourceReview.GaepApproval || wire.PrivacyBoundary != SummaryPrivacyBoundary)
        {
            throw InvalidResponse();
        }
        var classification = ParseClassification(wire.Classification);
        var reviewStatus = ParseReviewStatus(wire.SourceReview.Status);
        var expectedClaim = $"{wire.SourceReview.Status} upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness";
        if (wire.SourceReview.ClaimLabel != expectedClaim || wire.Source.Tool is null ||
            wire.Source.Tool.Length is < 1 or > 80 || !ToolPattern().IsMatch(wire.Source.Tool) ||
            wire.Counts.Artifacts is < 1 or > 512 || wire.Counts.NormalizedDesignTokens is < 0 or > 5_000 ||
            wire.Counts.ValidationChecks != 6 || wire.Counts.RecordedLimitations is < 1 or > 32 ||
            !DigestPattern().IsMatch(wire.Digests.Snapshot ?? "") || !DigestPattern().IsMatch(wire.Digests.Evidence ?? "") ||
            !DigestPattern().IsMatch(wire.Digests.Manifest ?? "") || !DigestPattern().IsMatch(wire.Digests.ArtifactInventory ?? "") ||
            !TryParseTimestamp(wire.Timestamps.SourceExportedAt, out var exportedAt) ||
            !TryParseTimestamp(wire.Timestamps.ImportedAt, out var importedAt))
        {
            throw InvalidResponse();
        }
        var exportMethod = ParseExportMethod(wire.Source.ExportMethod);
        Guid? initiativeId = wire.InitiativeId is null ? null : Guid.ParseExact(wire.InitiativeId, "D");
        return new PortableDesignSnapshotSummary(
            1,
            SummaryKind,
            bundleId,
            productId,
            initiativeId,
            wire.Title!,
            classification,
            new PortableDesignGovernanceMetadata(GovernanceState, true, ClaimBoundary, NonEscalation),
            new PortableDesignSourceReviewMetadata(reviewStatus, expectedClaim, false),
            new PortableDesignSourceMetadata(wire.Source.Tool, exportMethod),
            new PortableDesignCounts(
                wire.Counts.Artifacts,
                wire.Counts.NormalizedDesignTokens,
                wire.Counts.ValidationChecks,
                wire.Counts.RecordedLimitations),
            new PortableDesignDigests(
                wire.Digests.Snapshot!,
                wire.Digests.Evidence!,
                wire.Digests.Manifest!,
                wire.Digests.ArtifactInventory!),
            new PortableDesignTimestamps(exportedAt, importedAt),
            SummaryPrivacyBoundary);
    }

    private static PortableDesignClassification ParseClassification(string? value) => value switch
    {
        "public" => PortableDesignClassification.Public,
        "internal" => PortableDesignClassification.Internal,
        "confidential" => PortableDesignClassification.Confidential,
        "restricted" => PortableDesignClassification.Restricted,
        _ => throw InvalidResponse(),
    };

    private static PortableDesignSourceReviewStatus ParseReviewStatus(string? value) => value switch
    {
        "unreviewed" => PortableDesignSourceReviewStatus.Unreviewed,
        "reviewed" => PortableDesignSourceReviewStatus.Reviewed,
        "approved" => PortableDesignSourceReviewStatus.Approved,
        _ => throw InvalidResponse(),
    };

    private static PortableDesignExportMethod ParseExportMethod(string? value) => value switch
    {
        "manual-export" => PortableDesignExportMethod.ManualExport,
        "design-tool-export" => PortableDesignExportMethod.DesignToolExport,
        "plugin-export" => PortableDesignExportMethod.PluginExport,
        _ => throw InvalidResponse(),
    };

    private static bool ValidTitle(string? value) => value is not null && value.Length is >= 2 and <= 240 &&
        value == value.Trim() && !value.Any(char.IsControl);

    private static bool TryParseTimestamp(string? value, out DateTimeOffset timestamp) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out timestamp);

    private static bool HasOnlyProperties(JsonElement element, params string[] names)
    {
        var allowed = names.ToHashSet(StringComparer.Ordinal);
        var count = 0;
        foreach (var property in element.EnumerateObject())
        {
            count++;
            if (!allowed.Contains(property.Name)) return false;
        }
        return count == allowed.Count;
    }

    private static bool HasOnlyAllowedProperties(JsonElement element, params string[] names)
    {
        var allowed = names.ToHashSet(StringComparer.Ordinal);
        var actual = element.EnumerateObject().Select(property => property.Name).ToArray();
        return actual.Distinct(StringComparer.Ordinal).Count() == actual.Length && actual.All(allowed.Contains);
    }

    private static bool IsNetworkPath(string path)
    {
        if (path.StartsWith("//", StringComparison.Ordinal) || path.StartsWith("\\\\", StringComparison.Ordinal)) return true;
        return Uri.TryCreate(path, UriKind.Absolute, out var uri) && !uri.IsFile;
    }

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._:@+-]*$", RegexOptions.CultureInvariant)]
    private static partial Regex ActorIdPattern();

    [GeneratedRegex("^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex ToolPattern();

    [GeneratedRegex("^sha256:[0-9a-f]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex DigestPattern();

    private sealed class SnapshotWire
    {
        [JsonRequired] public int SchemaVersion { get; init; }
        [JsonRequired] public string? Kind { get; init; }
        [JsonRequired] public string? BundleId { get; init; }
        [JsonRequired] public string? ProductId { get; init; }
        public string? InitiativeId { get; init; }
        [JsonRequired] public string? Title { get; init; }
        [JsonRequired] public string? Classification { get; init; }
        [JsonRequired] public GovernanceWire? Governance { get; init; }
        [JsonRequired] public SourceReviewWire? SourceReview { get; init; }
        [JsonRequired] public SourceWire? Source { get; init; }
        [JsonRequired] public CountsWire? Counts { get; init; }
        [JsonRequired] public DigestsWire? Digests { get; init; }
        [JsonRequired] public TimestampsWire? Timestamps { get; init; }
        [JsonRequired] public string? PrivacyBoundary { get; init; }
    }

    private sealed class GovernanceWire
    {
        [JsonRequired] public string? State { get; init; }
        [JsonRequired] public bool HumanReviewRequired { get; init; }
        [JsonRequired] public string? ClaimBoundary { get; init; }
        [JsonRequired] public string? NonEscalation { get; init; }
    }

    private sealed class SourceReviewWire
    {
        [JsonRequired] public string? Status { get; init; }
        [JsonRequired] public string? ClaimLabel { get; init; }
        [JsonRequired] public bool GaepApproval { get; init; }
    }

    private sealed class SourceWire
    {
        [JsonRequired] public string? Tool { get; init; }
        [JsonRequired] public string? ExportMethod { get; init; }
    }

    private sealed class CountsWire
    {
        [JsonRequired] public int Artifacts { get; init; }
        [JsonRequired] public int NormalizedDesignTokens { get; init; }
        [JsonRequired] public int ValidationChecks { get; init; }
        [JsonRequired] public int RecordedLimitations { get; init; }
    }

    private sealed class DigestsWire
    {
        [JsonRequired] public string? Snapshot { get; init; }
        [JsonRequired] public string? Evidence { get; init; }
        [JsonRequired] public string? Manifest { get; init; }
        [JsonRequired] public string? ArtifactInventory { get; init; }
    }

    private sealed class TimestampsWire
    {
        [JsonRequired] public string? SourceExportedAt { get; init; }
        [JsonRequired] public string? ImportedAt { get; init; }
    }

    private sealed class PageWire
    {
        [JsonRequired] public List<SnapshotWire>? Items { get; init; }
        [JsonRequired] public int Offset { get; init; }
        [JsonRequired] public int Limit { get; init; }
        [JsonRequired] public int Total { get; init; }
        [JsonRequired] public bool HasMore { get; init; }
        [JsonRequired] public string? GovernanceBoundary { get; init; }
        [JsonRequired] public string? PrivacyBoundary { get; init; }
    }
}
