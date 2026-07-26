using System.Text.RegularExpressions;

namespace Gaep.HostClient;

/// <summary>
/// GAEP-P0-CS02 — pure, dependency-free request construction and validation for the Visual Studio
/// provider/model workflow. It builds the exact protocol-v3 params, enforces at least one governed
/// Context Pack ID (never an empty list), captures the analysis run ID from a response, and extracts
/// provider/model choices from a providerCatalog payload for the selection UI. Unit-tested in isolation.
/// </summary>
public static class GaepRequests
{
    public static IReadOnlyDictionary<string, object?> SelectProviderModel(string adapterId, string modelId)
    {
        if (string.IsNullOrWhiteSpace(adapterId))
        {
            throw new ArgumentException("A provider (adapterId) must be selected", nameof(adapterId));
        }

        if (string.IsNullOrWhiteSpace(modelId))
        {
            throw new ArgumentException("A model must be selected", nameof(modelId));
        }

        return new Dictionary<string, object?> { ["adapterId"] = adapterId, ["modelId"] = modelId };
    }

    public static IReadOnlyDictionary<string, object?> StartReadOnlyAnalysis(
        string objective,
        IReadOnlyList<string> contextPackIds,
        int timeoutMs = 120000,
        string? idempotencyKey = null)
    {
        if (string.IsNullOrWhiteSpace(objective))
        {
            throw new ArgumentException("An analysis objective is required", nameof(objective));
        }

        var ids = contextPackIds.Select(id => id.Trim()).Where(id => id.Length > 0).ToArray();
        if (ids.Length == 0)
        {
            throw new ArgumentException("At least one governed Context Pack ID is required", nameof(contextPackIds));
        }

        return new Dictionary<string, object?>
        {
            ["objective"] = objective,
            ["contextPackIds"] = ids,
            ["timeoutMs"] = timeoutMs,
            ["idempotencyKey"] = idempotencyKey ?? Guid.NewGuid().ToString(),
        };
    }

    public static IReadOnlyDictionary<string, object?> RunScoped(string analysisRunId)
    {
        if (string.IsNullOrWhiteSpace(analysisRunId))
        {
            throw new ArgumentException("An analysis run ID is required", nameof(analysisRunId));
        }

        return new Dictionary<string, object?> { ["analysisRunId"] = analysisRunId };
    }

    public static string? ExtractRunId(string responseJson)
        => Regex.Match(responseJson, "\"analysisRunId\"\\s*:\\s*\"([^\"]+)\"") is { Success: true } m ? m.Groups[1].Value : null;

    public static IReadOnlyList<string> ParseProviderIds(string catalogJson)
        => Regex.Matches(catalogJson, "\"adapterId\"\\s*:\\s*\"([^\"]+)\"").Select(m => m.Groups[1].Value).Distinct().ToArray();

    public static IReadOnlyList<string> ParseModelIds(string catalogJson, string adapterId)
    {
        var providerAt = catalogJson.IndexOf($"\"adapterId\":\"{adapterId}\"", StringComparison.Ordinal);
        if (providerAt < 0)
        {
            providerAt = catalogJson.IndexOf($"\"adapterId\": \"{adapterId}\"", StringComparison.Ordinal);
        }

        if (providerAt < 0)
        {
            return Array.Empty<string>();
        }

        var modelsAt = catalogJson.IndexOf("\"models\"", providerAt, StringComparison.Ordinal);
        if (modelsAt < 0)
        {
            return Array.Empty<string>();
        }

        var nextProvider = catalogJson.IndexOf("\"adapterId\"", modelsAt, StringComparison.Ordinal);
        var end = nextProvider < 0 ? catalogJson.Length : nextProvider;
        var slice = catalogJson[modelsAt..end];
        return Regex.Matches(slice, "\"id\"\\s*:\\s*\"([^\"]+)\"").Select(m => m.Groups[1].Value).Distinct().ToArray();
    }
}
