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
            ["INVALID_CAPABILITY_SNAPSHOT"] = (-32_010, "The GAEP engine could not verify the agent capability snapshot."),
            ["CAPABILITIES_NOT_AVAILABLE"] = (-32_011, "The GAEP engine could not observe agent capabilities."),
            ["EXECUTABLE_UNAVAILABLE"] = (-32_013, "The configured agent executable is unavailable."),
            ["EXECUTABLE_CHANGED"] = (-32_014, "The configured agent executable changed during capability discovery."),
            ["CAPABILITIES_CHANGED"] = (-32_012, "Agent capabilities changed during selection; probe again."),
            ["AGENT_SELECTION_ACTIVE_RUN"] = (-32_015, "Agent selection cannot change while a Run is non-terminal."),
            ["AGENT_SELECTION_MIGRATION_REQUIRED"] = (-32_016, "The legacy Agent Selection requires explicit re-probe and reconfirmation."),
            ["AGENT_SELECTION_HANDOFF_REQUIRED"] = (-32_017, "A versioned handoff is required before changing agent, model, or settings after a Run."),
            ["AGENT_SELECTION_INVALID"] = (-32_018, "The persisted Agent Selection is invalid and cannot be replaced implicitly."),
            ["INVALID_PARAMS"] = (-32_602, "The GAEP engine rejected the local request parameters."),
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

    internal static string ValidateSelectionIdentifier(string value, string label)
    {
        if (!ValidPortableText(value, minimum: 1))
        {
            throw new ArgumentException($"{label} must be verified portable capability text.", nameof(value));
        }
        return value;
    }

    internal static string ValidatePortableSettingInput(string value, string label, int minimum = 0)
    {
        if (!ValidPortableSettingText(value, minimum))
        {
            throw new ArgumentException(
                $"{label} must be portable text without paths, controls, or secret-shaped values.",
                nameof(value));
        }
        return value;
    }

    internal static IReadOnlyDictionary<string, object?> SerializePortableAgentSettings(
        IReadOnlyDictionary<string, PortableAgentSettingValue> settings)
    {
        ArgumentNullException.ThrowIfNull(settings);
        if (settings.Count > 128) throw new ArgumentException("Agent settings may contain at most 128 portable values.", nameof(settings));
        var serialized = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var (key, value) in settings)
        {
            if (!ValidPortableSettingKey(key))
            {
                throw new ArgumentException("Agent settings must use portable non-secret keys.", nameof(settings));
            }
            serialized[key] = SerializePortableAgentSettingValue(value);
        }
        return serialized;
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

    internal static IReadOnlyList<AgentReadinessSnapshot> ParseAgentReadinessResponse(JsonElement envelope)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Array || result.GetArrayLength() is < 1 or > 16) throw InvalidResponse();
        foreach (var snapshot in result.EnumerateArray()) ValidateAgentSnapshotShape(snapshot);
        List<AgentSnapshotWire> wires;
        try
        {
            wires = result.Deserialize<List<AgentSnapshotWire>>(StrictJson) ?? throw InvalidResponse();
        }
        catch (JsonException)
        {
            throw InvalidResponse();
        }
        var snapshots = wires.Select(ParseAgentSnapshot).OrderBy(snapshot => snapshot.AgentLabel, StringComparer.Ordinal).ToArray();
        if (snapshots.Select(snapshot => snapshot.AdapterId).Distinct(StringComparer.Ordinal).Count() != snapshots.Length ||
            snapshots.Select(snapshot => snapshot.AgentId).Distinct(StringComparer.Ordinal).Count() != snapshots.Length)
        {
            throw InvalidResponse();
        }
        return Array.AsReadOnly(snapshots);
    }

    internal static AgentSelectionState ParseAgentSelectionStateResponse(JsonElement envelope)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Object ||
            !result.TryGetProperty("status", out var statusElement) || statusElement.ValueKind != JsonValueKind.String)
        {
            throw InvalidResponse();
        }
        return statusElement.GetString() switch
        {
            "unselected" when HasOnlyProperties(result, "status") =>
                new AgentSelectionState(AgentSelectionStatus.Unselected, null, null),
            "selected" when HasOnlyProperties(result, "status", "selection") =>
                new AgentSelectionState(
                    AgentSelectionStatus.Selected,
                    ParseAgentSelection(result.GetProperty("selection")),
                    null),
            "migration-required" when HasOnlyProperties(result, "status", "portableCandidate") =>
                new AgentSelectionState(
                    AgentSelectionStatus.MigrationRequired,
                    null,
                    ParseAgentSelection(result.GetProperty("portableCandidate"))),
            "invalid" when HasOnlyProperties(result, "status") =>
                new AgentSelectionState(AgentSelectionStatus.Invalid, null, null),
            _ => throw InvalidResponse(),
        };
    }

    internal static AgentSelection ParseAgentSelectionResponse(JsonElement envelope) => ParseAgentSelection(ReadResult(envelope));

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
        "The GAEP engine host could not complete the request.");

    internal static EngineHostException InvalidResponse() => new(
        -32_603,
        "HOST_RESPONSE_INVALID",
        "The GAEP engine returned a local response that could not be verified.");

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
            !envelope.TryGetProperty("result", out var result))
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
            return new EngineHostException(-32_603, "HOST_ERROR", "The GAEP engine could not complete the request.");
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

    private static AgentReadinessSnapshot ParseAgentSnapshot(AgentSnapshotWire wire)
    {
        if (wire.SchemaVersion != 1 || !ValidPortableText(wire.AdapterId, minimum: 1) ||
            !ValidPortableText(wire.AdapterVersion, minimum: 1) || !ValidPortableText(wire.AgentId, minimum: 1) ||
            !ValidPortableText(wire.AgentLabel, minimum: 1) ||
            (wire.RuntimeVersion is not null && !ValidPortableText(wire.RuntimeVersion)) ||
            wire.ExecutionInterface is not ("cli-jsonl" or "cli-stream-json" or "stdio-rpc" or "managed-in-process" or "unavailable") ||
            wire.InterfaceMaturity is not ("stable" or "beta" or "experimental" or "unknown") ||
            wire.Settings is null || wire.Settings.Count > 256 || wire.Models is null || wire.Models.Count > 512 ||
            wire.Limitations is null || wire.Limitations.Count > 512 || !TryParseTimestamp(wire.ObservedAt, out var observedAt))
        {
            throw InvalidResponse();
        }
        var settings = wire.Settings.Select(ParseAgentSetting).ToArray();
        var models = wire.Models.Select(ParseAgentModel).ToArray();
        if (settings.Select(setting => setting.Key).Distinct(StringComparer.Ordinal).Count() != settings.Length ||
            models.Select(model => model.Id).Distinct(StringComparer.Ordinal).Count() != models.Length ||
            wire.Limitations.Any(limitation => !ValidPortableText(limitation)))
        {
            throw InvalidResponse();
        }
        return new AgentReadinessSnapshot(
            1,
            wire.AdapterId!,
            wire.AdapterVersion!,
            wire.AgentId!,
            wire.AgentLabel!,
            wire.RuntimeVersion,
            wire.Detected,
            wire.ExecutionInterface!,
            wire.InterfaceMaturity!,
            wire.SupportsResume,
            wire.SupportsCancel,
            wire.SupportsCheckpoints,
            wire.SupportsModelDiscovery,
            wire.SupportsToolSelection,
            wire.Settings.Count,
            Array.AsReadOnly(settings),
            Array.AsReadOnly(models),
            Array.AsReadOnly(wire.Limitations.ToArray()!),
            observedAt);
    }

    private static AgentModelReadiness ParseAgentModel(AgentModelWire wire)
    {
        if (!ValidPortableText(wire.Id, minimum: 1) || !ValidPortableText(wire.Label, minimum: 1) ||
            (wire.Description is not null && !ValidPortableText(wire.Description)) ||
            wire.ContextWindow is <= 0 || wire.ReasoningOptions is null || wire.ReasoningOptions.Count > 64 ||
            wire.InputModalities is null || wire.InputModalities.Count > 32 || !ValidTruthClass(wire.TruthClass) ||
            wire.ReasoningOptions.Any(value => !ValidPortableText(value)) ||
            wire.InputModalities.Any(value => !ValidPortableText(value)))
        {
            throw InvalidResponse();
        }
        return new AgentModelReadiness(wire.Id!, wire.Label!, wire.TruthClass!, wire.Alias);
    }

    private static AgentSelectionSetting ParseAgentSetting(AgentSettingWire wire)
    {
        if (wire.Key is null || !SettingKeyPattern().IsMatch(wire.Key) || !ValidPortableText(wire.Label, minimum: 1) ||
            !ValidPortableText(wire.Description, minimum: 1) ||
            wire.Kind is not ("select" or "boolean" or "number" or "string" or "string-list") ||
            !ValidTruthClass(wire.TruthClass) || (wire.Sensitive && wire.DefaultValue.ValueKind != JsonValueKind.Undefined) ||
            (wire.DefaultValue.ValueKind != JsonValueKind.Undefined && !ValidPortableSettingValue(wire.DefaultValue)) ||
            (wire.Minimum.ValueKind != JsonValueKind.Undefined && wire.Minimum.ValueKind != JsonValueKind.Number) ||
            (wire.Maximum.ValueKind != JsonValueKind.Undefined && wire.Maximum.ValueKind != JsonValueKind.Number) ||
            (wire.Options is not null && (wire.Options.Count > 256 || wire.Options.Any(option =>
                !ValidPortableText(option.Value) || !ValidPortableText(option.Label) ||
                (option.Description is not null && !ValidPortableText(option.Description))))))
        {
            throw InvalidResponse();
        }
        var defaultValue = wire.DefaultValue.ValueKind == JsonValueKind.Undefined
            ? null
            : ParsePortableSettingValue(wire.DefaultValue);
        var options = wire.Options?.Select(option => new AgentSettingOption(
            option.Value!,
            option.Label!,
            option.Description)).ToArray();
        double? minimum = wire.Minimum.ValueKind == JsonValueKind.Undefined ? null : wire.Minimum.GetDouble();
        double? maximum = wire.Maximum.ValueKind == JsonValueKind.Undefined ? null : wire.Maximum.GetDouble();
        if ((minimum.HasValue && !double.IsFinite(minimum.Value)) ||
            (maximum.HasValue && !double.IsFinite(maximum.Value)) ||
            (minimum.HasValue && maximum.HasValue && minimum.Value > maximum.Value))
        {
            throw InvalidResponse();
        }
        return new AgentSelectionSetting(
            wire.Key,
            wire.Label!,
            wire.Description!,
            wire.Kind!,
            wire.Required,
            wire.Sensitive,
            defaultValue,
            options is null ? null : Array.AsReadOnly(options),
            minimum,
            maximum,
            wire.TruthClass!);
    }

    private static bool ValidPortableSettingValue(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.String) return ValidPortableSettingText(value.GetString());
        if (value.ValueKind == JsonValueKind.Number) return value.TryGetDouble(out var number) && double.IsFinite(number);
        if (value.ValueKind is JsonValueKind.True or JsonValueKind.False) return true;
        return value.ValueKind == JsonValueKind.Array && value.GetArrayLength() <= 256 &&
            value.EnumerateArray().All(item => item.ValueKind == JsonValueKind.String &&
                ValidPortableSettingText(item.GetString()));
    }

    private static PortableAgentSettingValue ParsePortableSettingValue(JsonElement value)
    {
        if (!ValidPortableSettingValue(value)) throw InvalidResponse();
        return value.ValueKind switch
        {
            JsonValueKind.String => new PortableAgentText(value.GetString()!),
            JsonValueKind.Number => new PortableAgentNumber(value.GetDouble()),
            JsonValueKind.True => new PortableAgentBoolean(true),
            JsonValueKind.False => new PortableAgentBoolean(false),
            JsonValueKind.Array => new PortableAgentTextList(
                Array.AsReadOnly(value.EnumerateArray().Select(item => item.GetString()!).ToArray())),
            _ => throw InvalidResponse(),
        };
    }

    private static AgentSelection ParseAgentSelection(JsonElement selection)
    {
        if (selection.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                selection,
                "schemaVersion", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings",
                "selectedAt", "capabilityDigest") ||
            !selection.TryGetProperty("schemaVersion", out var schemaVersion) || schemaVersion.GetInt32() != 2 ||
            !TryGetPortableText(selection, "adapterId", out var adapterId) ||
            !TryGetPortableText(selection, "agentId", out var agentId) ||
            !TryGetPortableText(selection, "modelId", out var modelId) ||
            !selection.TryGetProperty("modelTruthClass", out var truthElement) || truthElement.ValueKind != JsonValueKind.String ||
            !ValidTruthClass(truthElement.GetString()) ||
            !selection.TryGetProperty("modelAlias", out var aliasElement) ||
            aliasElement.ValueKind is not (JsonValueKind.True or JsonValueKind.False or JsonValueKind.Null) ||
            !selection.TryGetProperty("settings", out var settingsElement) || settingsElement.ValueKind != JsonValueKind.Object ||
            settingsElement.EnumerateObject().Take(129).Count() > 128 ||
            !selection.TryGetProperty("selectedAt", out var selectedElement) || selectedElement.ValueKind != JsonValueKind.String ||
            !TryParseTimestamp(selectedElement.GetString(), out var selectedAt) ||
            !selection.TryGetProperty("capabilityDigest", out var digestElement) || digestElement.ValueKind != JsonValueKind.String ||
            !DigestPattern().IsMatch(digestElement.GetString() ?? string.Empty))
        {
            throw InvalidResponse();
        }
        var settings = new Dictionary<string, PortableAgentSettingValue>(StringComparer.Ordinal);
        foreach (var property in settingsElement.EnumerateObject())
        {
            if (!ValidPortableSettingKey(property.Name) || !settings.TryAdd(property.Name, ParsePortableSettingValue(property.Value)))
            {
                throw InvalidResponse();
            }
        }
        return new AgentSelection(
            2,
            adapterId!,
            agentId!,
            modelId!,
            truthElement.GetString()!,
            aliasElement.ValueKind == JsonValueKind.Null ? null : aliasElement.GetBoolean(),
            new System.Collections.ObjectModel.ReadOnlyDictionary<string, PortableAgentSettingValue>(settings),
            selectedAt,
            digestElement.GetString()!);
    }

    private static bool ValidTruthClass(string? value) =>
        value is "observed" or "provider-declared" or "configured" or "inferred" or "unknown";

    private static bool ValidPortableText(string? value, int minimum = 0, int maximum = 20_000) =>
        value is not null && value.Length >= minimum && value.Length <= maximum && !value.Any(char.IsControl) &&
        !AbsolutePathPattern().IsMatch(value.Trim()) && !PrivatePathPattern().IsMatch(value) && !SecretPattern().IsMatch(value);

    private static bool ValidPortableSettingText(string? value, int minimum = 0) =>
        value is not null && value.Length >= minimum && value.Length <= 10_000 && !value.Any(char.IsControl) &&
        !PortableSettingPathPattern().IsMatch(value) && !SecretPattern().IsMatch(value) &&
        !SecretEnvironmentSettingPattern().IsMatch(value);

    private static bool ValidPortableSettingKey(string key) =>
        SettingKeyPattern().IsMatch(key) && !SecretSettingKeyPattern().IsMatch(key) &&
        !key.Equals("secret", StringComparison.OrdinalIgnoreCase) && !key.Equals("token", StringComparison.OrdinalIgnoreCase);

    private static bool TryGetPortableText(JsonElement element, string propertyName, out string? value)
    {
        value = null;
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String) return false;
        value = property.GetString();
        return ValidPortableText(value, minimum: 1);
    }

    private static object SerializePortableAgentSettingValue(PortableAgentSettingValue value) => value switch
    {
        PortableAgentText text when ValidPortableSettingText(text.Value) => text.Value,
        PortableAgentNumber number when double.IsFinite(number.Value) => number.Value,
        PortableAgentBoolean boolean => boolean.Value,
        PortableAgentTextList list when list.Value.Count <= 256 && list.Value.All(item => ValidPortableSettingText(item)) =>
            list.Value.ToArray(),
        _ => throw new ArgumentException(
            "Agent settings must contain only verified portable, non-secret values.",
            nameof(value)),
    };

    private static void ValidateAgentSnapshotShape(JsonElement snapshot)
    {
        if (snapshot.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                snapshot,
                [
                    "schemaVersion", "adapterId", "adapterVersion", "agentId", "agentLabel", "detected",
                    "executionInterface", "interfaceMaturity", "supportsResume", "supportsCancel", "supportsCheckpoints",
                    "supportsModelDiscovery", "supportsToolSelection", "settings", "models", "limitations", "observedAt",
                ],
                ["runtimeVersion"]))
        {
            throw InvalidResponse();
        }
        if (!snapshot.TryGetProperty("settings", out var settings) || settings.ValueKind != JsonValueKind.Array ||
            !snapshot.TryGetProperty("models", out var models) || models.ValueKind != JsonValueKind.Array ||
            !snapshot.TryGetProperty("limitations", out var limitations) || limitations.ValueKind != JsonValueKind.Array)
        {
            throw InvalidResponse();
        }
        foreach (var setting in settings.EnumerateArray())
        {
            if (!HasRequiredAndAllowedProperties(
                    setting,
                    ["key", "label", "description", "kind", "required", "sensitive", "truthClass"],
                    ["defaultValue", "options", "minimum", "maximum"])) throw InvalidResponse();
            if (setting.TryGetProperty("options", out var options))
            {
                if (options.ValueKind != JsonValueKind.Array) throw InvalidResponse();
                foreach (var option in options.EnumerateArray())
                {
                    if (!HasRequiredAndAllowedProperties(option, ["value", "label"], ["description"])) throw InvalidResponse();
                }
            }
        }
        foreach (var model in models.EnumerateArray())
        {
            if (!HasRequiredAndAllowedProperties(
                    model,
                    ["id", "label", "reasoningOptions", "inputModalities", "truthClass", "alias"],
                    ["description", "contextWindow"])) throw InvalidResponse();
        }
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

    private static bool HasRequiredAndAllowedProperties(
        JsonElement element,
        IReadOnlyCollection<string> required,
        IReadOnlyCollection<string> optional)
    {
        if (element.ValueKind != JsonValueKind.Object) return false;
        var allowed = required.Concat(optional).ToHashSet(StringComparer.Ordinal);
        var actual = element.EnumerateObject().Select(property => property.Name).ToArray();
        return actual.Distinct(StringComparer.Ordinal).Count() == actual.Length &&
            required.All(name => actual.Contains(name, StringComparer.Ordinal)) && actual.All(allowed.Contains);
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

    [GeneratedRegex("^[a-z][a-zA-Z0-9]{0,127}$", RegexOptions.CultureInvariant)]
    private static partial Regex SettingKeyPattern();

    [GeneratedRegex(@"^(?:/[^\s]*|[A-Za-z]:[\\/][^\s]*|\\\\[^\s]*|file://[^\s]*)$", RegexOptions.CultureInvariant)]
    private static partial Regex AbsolutePathPattern();

    [GeneratedRegex(@"^(?:/|[A-Za-z]:[\\/]|\\\\|file://|~[\\/])", RegexOptions.CultureInvariant)]
    private static partial Regex PortableSettingPathPattern();

    [GeneratedRegex(@"(?:^|[\s(=""'])(?:/(?:Users|home|tmp|private|Volumes)/[^\s""'<>)]*|[A-Za-z]:\\[^\s""'<>)]*|\\\\[^\s""'<>)]*)", RegexOptions.CultureInvariant)]
    private static partial Regex PrivatePathPattern();

    [GeneratedRegex(@"\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex SecretPattern();

    [GeneratedRegex("(?:apiKey|accessToken|refreshToken|authToken|bearerToken|password|passwd|clientSecret|privateKey|credential)", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex SecretSettingKeyPattern();

    [GeneratedRegex(@"^\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\}?$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex SecretEnvironmentSettingPattern();

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

    private sealed class AgentSnapshotWire
    {
        [JsonRequired] public int SchemaVersion { get; init; }
        [JsonRequired] public string? AdapterId { get; init; }
        [JsonRequired] public string? AdapterVersion { get; init; }
        [JsonRequired] public string? AgentId { get; init; }
        [JsonRequired] public string? AgentLabel { get; init; }
        public string? RuntimeVersion { get; init; }
        [JsonRequired] public bool Detected { get; init; }
        [JsonRequired] public string? ExecutionInterface { get; init; }
        [JsonRequired] public string? InterfaceMaturity { get; init; }
        [JsonRequired] public bool SupportsResume { get; init; }
        [JsonRequired] public bool SupportsCancel { get; init; }
        [JsonRequired] public bool SupportsCheckpoints { get; init; }
        [JsonRequired] public bool SupportsModelDiscovery { get; init; }
        [JsonRequired] public bool SupportsToolSelection { get; init; }
        [JsonRequired] public List<AgentSettingWire>? Settings { get; init; }
        [JsonRequired] public List<AgentModelWire>? Models { get; init; }
        [JsonRequired] public List<string>? Limitations { get; init; }
        [JsonRequired] public string? ObservedAt { get; init; }
    }

    private sealed class AgentModelWire
    {
        [JsonRequired] public string? Id { get; init; }
        [JsonRequired] public string? Label { get; init; }
        public string? Description { get; init; }
        [JsonRequired] public List<string>? ReasoningOptions { get; init; }
        public long? ContextWindow { get; init; }
        [JsonRequired] public List<string>? InputModalities { get; init; }
        [JsonRequired] public string? TruthClass { get; init; }
        [JsonRequired] public bool Alias { get; init; }
    }

    private sealed class AgentSettingWire
    {
        [JsonRequired] public string? Key { get; init; }
        [JsonRequired] public string? Label { get; init; }
        [JsonRequired] public string? Description { get; init; }
        [JsonRequired] public string? Kind { get; init; }
        [JsonRequired] public bool Required { get; init; }
        [JsonRequired] public bool Sensitive { get; init; }
        public JsonElement DefaultValue { get; init; }
        public List<AgentSettingOptionWire>? Options { get; init; }
        public JsonElement Minimum { get; init; }
        public JsonElement Maximum { get; init; }
        [JsonRequired] public string? TruthClass { get; init; }
    }

    private sealed class AgentSettingOptionWire
    {
        [JsonRequired] public string? Value { get; init; }
        [JsonRequired] public string? Label { get; init; }
        public string? Description { get; init; }
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
