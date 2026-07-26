using Gaep.HostClient;
using Xunit;

namespace Gaep.Tests;

public class GaepRequestsTests
{
    [Fact]
    public void SelectProviderModel_CarriesTheChosenProviderAndModel()
    {
        var request = GaepRequests.SelectProviderModel("gaep.codex-cli", "gpt-5-codex");
        Assert.Equal("gaep.codex-cli", request["adapterId"]);
        Assert.Equal("gpt-5-codex", request["modelId"]);
    }

    [Fact]
    public void StartReadOnlyAnalysis_RequiresAtLeastOneContextPackId()
    {
        Assert.Throws<ArgumentException>(() => GaepRequests.StartReadOnlyAnalysis("Summarize", Array.Empty<string>()));
        Assert.Throws<ArgumentException>(() => GaepRequests.StartReadOnlyAnalysis("Summarize", new[] { "   " }));
    }

    [Fact]
    public void StartReadOnlyAnalysis_RequiresANonBlankObjective()
    {
        Assert.Throws<ArgumentException>(() => GaepRequests.StartReadOnlyAnalysis("  ", new[] { "pack-a" }));
    }

    [Fact]
    public void StartReadOnlyAnalysis_IncludesTheGovernedContextPackIds()
    {
        var request = GaepRequests.StartReadOnlyAnalysis("Summarize the governed context", new[] { "pack-a", "pack-b" });
        var ids = Assert.IsAssignableFrom<string[]>(request["contextPackIds"]);
        Assert.Equal(new[] { "pack-a", "pack-b" }, ids);
    }

    [Fact]
    public void ExtractRunId_CapturesTheRunIdFromAStartResponse()
    {
        Assert.Equal("run-123", GaepRequests.ExtractRunId("{\"analysisRunId\":\"run-123\",\"state\":\"running\"}"));
        Assert.Null(GaepRequests.ExtractRunId("{\"state\":\"running\"}"));
    }

    [Fact]
    public void ParseProviderAndModelIds_ReadsACatalogPayload()
    {
        const string catalog = "{\"providers\":[" +
            "{\"adapterId\":\"gaep.codex-cli\",\"models\":[{\"id\":\"gpt-5-codex\"}]}," +
            "{\"adapterId\":\"gaep.claude-code-cli\",\"models\":[{\"id\":\"sonnet\"},{\"id\":\"opus\"}]}]}";
        Assert.Equal(new[] { "gaep.codex-cli", "gaep.claude-code-cli" }, GaepRequests.ParseProviderIds(catalog));
        Assert.Equal(new[] { "sonnet", "opus" }, GaepRequests.ParseModelIds(catalog, "gaep.claude-code-cli"));
        Assert.Equal(new[] { "gpt-5-codex" }, GaepRequests.ParseModelIds(catalog, "gaep.codex-cli"));
    }
}
